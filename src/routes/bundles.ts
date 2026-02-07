import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db';
import { ulidLike } from '../ids';

const CreateBundleSchema = z.object({
  factory_code: z.string().min(1),
  order_id: z.string().min(1),
  style: z.string().min(1),
  color: z.string().min(1),
  size: z.string().min(1),
  qty: z.coerce.number().int().positive().default(10),
  line_route: z.array(z.string()).optional(),
  rfid_uid: z.string().min(1)
});

export function bundlesRouter(db: Db) {
  const r = Router();

  r.post('/', async (req, res) => {
    const parsed = CreateBundleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_request', details: parsed.error.flatten() });
    }

    const body = parsed.data;

    // Determine factory (required)
    const f = await db.query('SELECT id FROM factories WHERE code = $1 LIMIT 1', [body.factory_code]);
    const factoryId = f.rows[0]?.id;
    if (!factoryId) {
      return res.status(400).json({ ok: false, error: 'unknown_factory' });
    }

    const bundleId = ulidLike('bdl');

    try {
      await db.query(
        `INSERT INTO bundles (id, factory_id, order_id, style, color, size, qty, line_route, rfid_uid, status, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'created', now())`,
        [
          bundleId,
          factoryId,
          body.order_id,
          body.style,
          body.color,
          body.size,
          body.qty,
          body.line_route ? JSON.stringify(body.line_route) : null,
          body.rfid_uid
        ]
      );
    } catch (e: any) {
      if (String(e?.message ?? '').includes('duplicate') || String(e?.code ?? '') === '23505') {
        return res.status(409).json({ ok: false, error: 'rfid_already_assigned' });
      }
      throw e;
    }

    return res.status(201).json({ bundle_id: bundleId, rfid_uid: body.rfid_uid });
  });

  r.get('/by-rfid/:rfidUid', async (req, res) => {
    const rfidUid = req.params.rfidUid;
    const q = await db.query('SELECT * FROM bundles WHERE rfid_uid = $1 LIMIT 1', [rfidUid]);
    if (q.rows.length === 0) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, bundle: q.rows[0] });
  });

  return r;
}
