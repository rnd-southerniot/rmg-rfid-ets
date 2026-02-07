import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db';
import { adminAuth } from '../adminAuth';
import { ulidLike } from '../ids';

const FactoryCreateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1).optional()
});

const LineCreateSchema = z.object({
  factory_code: z.string().min(1),
  name: z.string().min(1)
});

const StationMapSchema = z.object({
  station_id: z.string().min(1),
  // allow either, but at least one must be present
  line_id: z.string().min(1).optional(),
  line_name: z.string().min(1).optional(),
  type: z.enum(['cutting', 'sewing', 'finishing', 'qc'])
}).refine((v) => Boolean(v.line_id || v.line_name), {
  message: 'Provide line_id or line_name'
});

export function adminRouter(db: Db) {
  const r = Router();
  r.use(adminAuth());

  // Factories
  r.get('/factories', async (_req, res) => {
    const q = await db.query('SELECT id, code, name FROM factories ORDER BY code ASC');
    return res.json({ ok: true, factories: q.rows });
  });

  r.post('/factories', async (req, res) => {
    const parsed = FactoryCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { code, name } = parsed.data;
    const id = ulidLike('fac');

    try {
      await db.query('INSERT INTO factories (id, code, name) VALUES ($1,$2,$3)', [id, code, name ?? code]);
    } catch (e: any) {
      if (String(e?.code ?? '') === '23505') {
        return res.status(409).json({ ok: false, error: 'factory_code_taken' });
      }
      throw e;
    }

    const q = await db.query('SELECT id, code, name FROM factories WHERE id = $1', [id]);
    return res.status(201).json({ ok: true, factory: q.rows[0] });
  });

  // Lines
  r.get('/lines', async (req, res) => {
    const factoryCode = String(req.query.factory_code ?? '').trim();
    if (!factoryCode) return res.status(400).json({ ok: false, error: 'invalid_request', details: { factory_code: 'required' } });

    const f = await db.query('SELECT id FROM factories WHERE code = $1 LIMIT 1', [factoryCode]);
    const factoryId = f.rows[0]?.id;
    if (!factoryId) return res.status(400).json({ ok: false, error: 'unknown_factory' });

    const q = await db.query('SELECT id, factory_id, name FROM lines WHERE factory_id = $1 ORDER BY name ASC', [factoryId]);
    return res.json({ ok: true, lines: q.rows });
  });

  r.post('/lines', async (req, res) => {
    const parsed = LineCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { factory_code, name } = parsed.data;

    const f = await db.query('SELECT id FROM factories WHERE code = $1 LIMIT 1', [factory_code]);
    const factoryId = f.rows[0]?.id;
    if (!factoryId) return res.status(400).json({ ok: false, error: 'unknown_factory' });

    const id = ulidLike('ln');

    try {
      await db.query('INSERT INTO lines (id, factory_id, name) VALUES ($1,$2,$3)', [id, factoryId, name]);
    } catch (e: any) {
      if (String(e?.code ?? '') === '23505') {
        return res.status(409).json({ ok: false, error: 'line_exists' });
      }
      throw e;
    }

    const q = await db.query('SELECT id, factory_id, name FROM lines WHERE id = $1', [id]);
    return res.status(201).json({ ok: true, line: q.rows[0] });
  });

  // Stations
  r.get('/stations', async (req, res) => {
    const factoryCode = String(req.query.factory_code ?? '').trim();
    if (!factoryCode) return res.status(400).json({ ok: false, error: 'invalid_request', details: { factory_code: 'required' } });

    const f = await db.query('SELECT id FROM factories WHERE code = $1 LIMIT 1', [factoryCode]);
    const factoryId = f.rows[0]?.id;
    if (!factoryId) return res.status(400).json({ ok: false, error: 'unknown_factory' });

    const q = await db.query(
      `SELECT s.id, s.mac, s.station_id, s.line_id, l.name as line_name, s.type, s.fw, s.capabilities, s.last_seen_at, s.created_at, s.updated_at
       FROM stations s
       LEFT JOIN lines l ON l.id = s.line_id
       WHERE s.factory_id = $1
       ORDER BY s.mac ASC`,
      [factoryId]
    );

    return res.json({ ok: true, stations: q.rows });
  });

  r.patch('/stations/:id/map', async (req, res) => {
    const stationPk = req.params.id;

    const parsed = StationMapSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { station_id, line_id, line_name, type } = parsed.data;

    const st0 = await db.query('SELECT id, factory_id FROM stations WHERE id = $1 LIMIT 1', [stationPk]);
    if (st0.rows.length === 0) return res.status(404).json({ ok: false, error: 'not_found' });
    const factoryId = st0.rows[0].factory_id as string;

    let resolvedLineId: string | null = null;
    if (line_id) {
      const l0 = await db.query('SELECT id FROM lines WHERE id = $1 AND factory_id = $2 LIMIT 1', [line_id, factoryId]);
      if (l0.rows.length === 0) return res.status(400).json({ ok: false, error: 'unknown_line' });
      resolvedLineId = l0.rows[0].id as string;
    } else if (line_name) {
      const l0 = await db.query('SELECT id FROM lines WHERE name = $1 AND factory_id = $2 LIMIT 1', [line_name, factoryId]);
      if (l0.rows.length === 0) return res.status(400).json({ ok: false, error: 'unknown_line' });
      resolvedLineId = l0.rows[0].id as string;
    }

    try {
      await db.query(
        'UPDATE stations SET station_id = $2, line_id = $3, type = $4, updated_at = now() WHERE id = $1',
        [stationPk, station_id, resolvedLineId, type]
      );
    } catch (e: any) {
      // unique(factory_id, station_id)
      if (String(e?.code ?? '') === '23505') {
        return res.status(409).json({ ok: false, error: 'station_id_taken' });
      }
      throw e;
    }

    const q = await db.query(
      `SELECT s.id, s.mac, s.station_id, s.line_id, l.name as line_name, s.type
       FROM stations s
       LEFT JOIN lines l ON l.id = s.line_id
       WHERE s.id = $1`,
      [stationPk]
    );

    return res.json({ ok: true, station: q.rows[0] });
  });

  return r;
}
