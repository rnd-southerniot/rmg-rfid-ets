import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db';
import { RfidUidSchema } from '../validation';
import { signJwt } from '../jwt';

const LoginSchema = z.object({
  rfid_uid: RfidUidSchema
});

export function authRouter(_db: Db, opts: { jwtSecret: string; loginRfidUids: string[] }) {
  const r = Router();
  const allowedUids = new Set(opts.loginRfidUids.map((s) => s.trim().toUpperCase()));

  r.post('/login', (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_request', details: parsed.error.flatten() });
    }

    const uid = parsed.data.rfid_uid;
    if (!allowedUids.has(uid)) {
      return res.status(401).json({ ok: false, error: 'invalid_credentials' });
    }

    const token = signJwt({ sub: uid }, opts.jwtSecret);
    return res.json({ ok: true, token });
  });

  return r;
}
