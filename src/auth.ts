import type { RequestHandler } from 'express';
import { tokenHash } from './ids';
import type { Db } from './db';

export type AuthedStation = {
  id: string;
  factory_id: string;
  mac: string;
  station_id: string | null;
  line_id: string | null;
  type: string | null;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      station?: AuthedStation;
    }
  }
}

export function stationAuth(db: Db): RequestHandler {
  return async (req, res, next) => {
    const hdr = req.header('authorization') || '';
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ ok: false, error: 'unauthorized' });

    const token = m[1];
    const hash = tokenHash(token);
    const q = await db.query(
      `SELECT id, factory_id, mac, station_id, line_id, type
       FROM stations
       WHERE token_hash = $1
       LIMIT 1`,
      [hash]
    );

    if (q.rows.length === 0) return res.status(401).json({ ok: false, error: 'unauthorized' });

    req.station = q.rows[0] as AuthedStation;
    next();
  };
}
