import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db';
import { adminAuth } from '../adminAuth';

const ListQuerySchema = z.object({
  factory_code: z.string().min(1),
  status: z.string().optional(),
  order_id: z.string().optional(),
  rfid_uid: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export function adminBundlesRouter(db: Db) {
  const r = Router();
  r.use(adminAuth());

  r.get('/', async (req, res) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { factory_code, status, order_id, rfid_uid, limit, offset } = parsed.data;

    const f = await db.query('SELECT id FROM factories WHERE code = $1 LIMIT 1', [factory_code]);
    const factoryId = f.rows[0]?.id;
    if (!factoryId) return res.status(400).json({ ok: false, error: 'unknown_factory' });

    const conditions: string[] = ['b.factory_id = $1'];
    const params: any[] = [factoryId];
    let idx = 2;

    if (status) {
      conditions.push(`b.status = $${idx++}`);
      params.push(status);
    }
    if (order_id) {
      conditions.push(`b.order_id = $${idx++}`);
      params.push(order_id);
    }
    if (rfid_uid) {
      conditions.push(`b.rfid_uid ILIKE $${idx++}`);
      params.push(`%${rfid_uid}%`);
    }

    const where = conditions.join(' AND ');
    params.push(limit, offset);

    const q = await db.query(
      `SELECT b.id, b.order_id, b.style, b.color, b.size, b.qty, b.rfid_uid,
              b.status, b.current_station_id, b.current_line_id,
              s.station_id as current_station_name, l.name as current_line_name,
              b.updated_at
       FROM bundles b
       LEFT JOIN stations s ON s.id = b.current_station_id
       LEFT JOIN lines l ON l.id = b.current_line_id
       WHERE ${where}
       ORDER BY b.updated_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    return res.json({ ok: true, bundles: q.rows });
  });

  r.get('/:id/events', async (req, res) => {
    const bundleId = req.params.id;

    const b = await db.query('SELECT id FROM bundles WHERE id = $1 LIMIT 1', [bundleId]);
    if (b.rows.length === 0) return res.status(404).json({ ok: false, error: 'not_found' });

    const q = await db.query(
      `SELECT e.id, e.event_id, e.event_type, e.ts, e.meta,
              e.station_id, s.station_id as station_name, s.type as station_type,
              e.line_id, l.name as line_name
       FROM events e
       LEFT JOIN stations s ON s.id = e.station_id
       LEFT JOIN lines l ON l.id = e.line_id
       WHERE e.bundle_id = $1
       ORDER BY e.ts ASC`,
      [bundleId]
    );

    return res.json({ ok: true, bundle_id: bundleId, events: q.rows });
  });

  return r;
}
