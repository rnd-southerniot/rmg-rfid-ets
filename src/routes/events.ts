import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { Db } from '../db';
import { stationAuth } from '../auth';
import { EventTypeSchema, IsoTsSchema, RfidUidSchema } from '../validation';
import { ulidLike } from '../ids';
import { verifyJwt } from '../jwt';

const DefectSchema = z.object({
  code: z.string().min(1),
  qty: z.coerce.number().int().positive().optional(),
  severity: z.string().optional(),
  note: z.string().optional()
});

const EventSchema = z.object({
  event_id: z.string().min(1),
  ts: IsoTsSchema,
  bundle: z.object({ rfid_uid: RfidUidSchema }),
  event_type: EventTypeSchema,
  meta: z.record(z.any()).optional(),
  defects: z.array(DefectSchema).optional(),
  photo_urls: z.array(z.string().url()).optional()
});

function isStationMapped(st: { station_id: string | null; line_id: string | null; type: string | null }) {
  return Boolean(st.station_id && st.line_id && st.type);
}

function isEventAllowedForStation(stType: string, eventType: 'COMPLETE' | 'QC_PASS' | 'QC_FAIL') {
  // MVP rule:
  // - cutting/sewing/finishing stations can only emit COMPLETE
  // - qc stations can only emit QC_PASS / QC_FAIL
  if (stType === 'qc') return eventType === 'QC_PASS' || eventType === 'QC_FAIL';
  return eventType === 'COMPLETE';
}

function userTokenAuth(jwtSecret: string): RequestHandler {
  return (req, res, next) => {
    const raw = req.header('x-user-token');
    if (!raw) {
      return res.status(401).json({ ok: false, error: 'missing_user_token' });
    }
    const payload = verifyJwt(raw, jwtSecret);
    if (!payload) {
      return res.status(401).json({ ok: false, error: 'invalid_user_token' });
    }
    next();
  };
}

export function eventsRouter(db: Db, opts: { jwtSecret: string; loginRfidUids: string[] }) {
  const r = Router();
  const employeeUids = new Set(opts.loginRfidUids.map((s) => s.trim().toUpperCase()));

  r.post('/', stationAuth(db), userTokenAuth(opts.jwtSecret), async (req, res) => {
    const st = req.station!;
    if (!isStationMapped(st)) {
      return res.status(409).json({ ok: false, error: 'station_unmapped' });
    }

    const parsed = EventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_request', details: parsed.error.flatten() });
    }

    const body = parsed.data;

    // Employee badge tap → device must logout. Don't record anything.
    if (employeeUids.has(body.bundle.rfid_uid)) {
      return res.json({ ok: true, action: 'logout' });
    }

    if (!isEventAllowedForStation(st.type!, body.event_type)) {
      return res.status(409).json({ ok: false, error: 'station_type_mismatch' });
    }

    const ts = new Date(body.ts);

    // Resolve bundle
    const b = await db.query(
      `SELECT id, factory_id
       FROM bundles
       WHERE rfid_uid = $1
       LIMIT 1`,
      [body.bundle.rfid_uid]
    );

    if (b.rows.length === 0) {
      // Bundle not yet bound to this UID. Record the tap in rfid_registry so
      // an admin can bind it to a bundle later. Do NOT record an event.
      await db.query(
        `INSERT INTO rfid_registry (rfid_uid, factory_id, last_station_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (rfid_uid) DO UPDATE
           SET last_seen_at = now(),
               scan_count  = rfid_registry.scan_count + 1,
               last_station_id = EXCLUDED.last_station_id`,
        [body.bundle.rfid_uid, st.factory_id, st.id]
      );
      return res.json({ ok: true, action: 'registered' });
    }

    const bundleId = b.rows[0].id as string;
    const factoryId = b.rows[0].factory_id as string;

    const eventPk = ulidLike('evt');
    const meta = {
      ...(body.meta ?? {}),
      defects: body.defects,
      photo_urls: body.photo_urls
    };

    // Idempotent insert
    const insert = await db.query(
      `INSERT INTO events (id, factory_id, event_id, bundle_id, station_id, line_id, event_type, ts, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (station_id, event_id) DO NOTHING`,
      [eventPk, factoryId, body.event_id, bundleId, st.id, st.line_id, body.event_type, ts.toISOString(), JSON.stringify(meta)]
    );

    if (insert.rowCount > 0) {
      const nextStatus =
        body.event_type === 'QC_PASS'
          ? 'qc_pass'
          : body.event_type === 'QC_FAIL'
            ? 'qc_fail'
            : 'in_progress';

      await db.query(
        `UPDATE bundles
         SET current_station_id = $2,
             current_line_id = $3,
             status = $4,
             updated_at = now()
         WHERE id = $1`,
        [bundleId, st.id, st.line_id, nextStatus]
      );
    }

    return res.json({ ok: true, action: 'recorded' });
  });

  return r;
}
