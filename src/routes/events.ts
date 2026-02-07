import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db';
import { stationAuth } from '../auth';
import { EventTypeSchema, IsoTsSchema } from '../validation';
import { ulidLike } from '../ids';

const DefectSchema = z.object({
  code: z.string().min(1),
  qty: z.coerce.number().int().positive().optional(),
  severity: z.string().optional(),
  note: z.string().optional()
});

const EventSchema = z.object({
  event_id: z.string().min(1),
  ts: IsoTsSchema,
  bundle: z.object({ rfid_uid: z.string().min(1) }),
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

export function eventsRouter(db: Db) {
  const r = Router();

  r.post('/', stationAuth(db), async (req, res) => {
    const st = req.station!;
    if (!isStationMapped(st)) {
      return res.status(409).json({ ok: false, error: 'station_unmapped' });
    }

    const parsed = EventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_request', details: parsed.error.flatten() });
    }

    const body = parsed.data;

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
      return res.status(404).json({ ok: false, error: 'unknown_bundle' });
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

    return res.json({ ok: true });
  });

  return r;
}
