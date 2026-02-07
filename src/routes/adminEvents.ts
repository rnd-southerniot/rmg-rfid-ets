import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db';
import { adminAuth } from '../adminAuth';

const RecentSchema = z.object({
  factory_code: z.string().min(1),
  limit: z.coerce.number().int().positive().max(500).default(100)
});

export function adminEventsRouter(db: Db) {
  const r = Router();
  r.use(adminAuth());

  r.get('/recent', async (req, res) => {
    const parsed = RecentSchema.safeParse({
      factory_code: req.query.factory_code,
      limit: req.query.limit
    });

    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { factory_code, limit } = parsed.data;

    const f = await db.query('SELECT id FROM factories WHERE code = $1 LIMIT 1', [factory_code]);
    const factoryId = f.rows[0]?.id;
    if (!factoryId) return res.status(400).json({ ok: false, error: 'unknown_factory' });

    const q = await db.query(
      `SELECT e.id,
              e.event_id,
              e.event_type,
              e.ts,
              e.created_at,
              e.bundle_id,
              b.rfid_uid,
              b.order_id,
              s.id as station_pk,
              s.station_id,
              s.mac,
              s.type as station_type,
              l.name as line_name
       FROM events e
       JOIN bundles b ON b.id = e.bundle_id
       JOIN stations s ON s.id = e.station_id
       LEFT JOIN lines l ON l.id = e.line_id
       WHERE e.factory_id = $1
       ORDER BY e.ts DESC
       LIMIT $2`,
      [factoryId, limit]
    );

    return res.json({ ok: true, events: q.rows });
  });

  // SSE stream: sends `event: ping` every ~15s and `event: event` for new rows.
  r.get('/stream', async (req, res) => {
    const factoryCode = String(req.query.factory_code ?? '').trim();
    if (!factoryCode) return res.status(400).json({ ok: false, error: 'invalid_request', details: { factory_code: 'required' } });

    const f = await db.query('SELECT id FROM factories WHERE code = $1 LIMIT 1', [factoryCode]);
    const factoryId = f.rows[0]?.id;
    if (!factoryId) return res.status(400).json({ ok: false, error: 'unknown_factory' });

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // If behind a proxy, this helps disable buffering (nginx).
    res.setHeader('X-Accel-Buffering', 'no');

    const writeEvent = (name: string, data: any) => {
      res.write(`event: ${name}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    writeEvent('hello', { ok: true, factory_code: factoryCode, ts: new Date().toISOString() });

    let lastTs = new Date(Date.now() - 5_000).toISOString();

    const pollEveryMs = 1000;
    const poll = async () => {
      try {
        const q = await db.query(
          `SELECT e.id,
                  e.event_id,
                  e.event_type,
                  e.ts,
                  e.created_at,
                  e.bundle_id,
                  b.rfid_uid,
                  b.order_id,
                  s.id as station_pk,
                  s.station_id,
                  s.mac,
                  s.type as station_type,
                  l.name as line_name
           FROM events e
           JOIN bundles b ON b.id = e.bundle_id
           JOIN stations s ON s.id = e.station_id
           LEFT JOIN lines l ON l.id = e.line_id
           WHERE e.factory_id = $1
             AND e.ts > $2
           ORDER BY e.ts ASC
           LIMIT 200`,
          [factoryId, lastTs]
        );

        for (const row of q.rows) {
          lastTs = new Date(row.ts).toISOString();
          writeEvent('event', row);
        }
      } catch (e: any) {
        writeEvent('error', { message: e?.message ?? String(e) });
      }
    };

    const pollTimer = setInterval(poll, pollEveryMs);
    const pingTimer = setInterval(() => writeEvent('ping', { ts: new Date().toISOString() }), 15000);

    req.on('close', () => {
      clearInterval(pollTimer);
      clearInterval(pingTimer);
    });
  });

  return r;
}
