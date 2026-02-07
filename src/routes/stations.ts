import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db';
import { MacSchema } from '../validation';
import { stationToken, tokenHash, ulidLike } from '../ids';

const ClaimSchema = z.object({
  factory_code: z.string().min(1),
  mac: MacSchema,
  fw: z.string().min(1).optional(),
  capabilities: z.record(z.any()).optional()
});

export function stationsRouter(db: Db) {
  const r = Router();

  r.post('/claim', async (req, res) => {
    const parsed = ClaimSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { factory_code, mac, fw, capabilities } = parsed.data;

    // Ensure factory exists
    const f0 = await db.query('SELECT id, code, name FROM factories WHERE code = $1 LIMIT 1', [factory_code]);
    let factoryId = f0.rows[0]?.id as string | undefined;
    if (!factoryId) {
      factoryId = ulidLike('fac');
      await db.query('INSERT INTO factories (id, name, code) VALUES ($1, $2, $3)', [
        factoryId,
        factory_code,
        factory_code
      ]);
    }

    // Find/create station by MAC
    const s0 = await db.query(
      `SELECT id, mac, station_id, line_id, type
       FROM stations
       WHERE mac = $1
       LIMIT 1`,
      [mac]
    );

    let stationIdPk: string;
    if (s0.rows.length === 0) {
      stationIdPk = ulidLike('st');
      await db.query(
        `INSERT INTO stations (id, factory_id, mac, station_id, line_id, type, fw, capabilities)
         VALUES ($1,$2,$3,NULL,NULL,NULL,$4,$5)`,
        [stationIdPk, factoryId, mac, fw ?? null, capabilities ?? null]
      );
    } else {
      stationIdPk = s0.rows[0].id as string;
      // bind to factory if unset/mismatched? For MVP, keep existing factory_id.
      await db.query('UPDATE stations SET fw = COALESCE($2, fw), capabilities = COALESCE($3, capabilities), updated_at = now() WHERE id = $1', [
        stationIdPk,
        fw ?? null,
        capabilities ?? null
      ]);
    }

    const token = stationToken();
    const hash = tokenHash(token);
    await db.query('UPDATE stations SET token_hash = $2, updated_at = now() WHERE id = $1', [stationIdPk, hash]);

    const stationRow = await db.query(
      `SELECT id, mac, station_id, line_id, type
       FROM stations
       WHERE id = $1`,
      [stationIdPk]
    );

    return res.json({
      station: stationRow.rows[0],
      token,
      config: {
        eventMode: 'complete',
        clockSkewMsMax: 300000
      }
    });
  });

  return r;
}
