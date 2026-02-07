import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db';
import { stationAuth } from '../auth';

const HeartbeatSchema = z.object({
  ts: z.string().datetime().optional(),
  meta: z.record(z.any()).optional()
});

export function stationStatusRouter(db: Db) {
  const r = Router();

  // Station heartbeat: updates last_seen_at.
  r.post('/heartbeat', stationAuth(db), async (req, res) => {
    const parsed = HeartbeatSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_request', details: parsed.error.flatten() });
    }

    const ts = parsed.data.ts ? new Date(parsed.data.ts) : new Date();
    await db.query('UPDATE stations SET last_seen_at = $2, updated_at = now() WHERE id = $1', [req.station!.id, ts.toISOString()]);
    return res.json({ ok: true });
  });

  // Introspection endpoint for a station.
  r.get('/me', stationAuth(db), async (req, res) => {
    const q = await db.query(
      'SELECT id, factory_id, mac, station_id, line_id, type, fw, capabilities, last_seen_at, created_at, updated_at FROM stations WHERE id = $1',
      [req.station!.id]
    );
    return res.json({ ok: true, station: q.rows[0] });
  });

  return r;
}
