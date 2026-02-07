import type { RequestHandler } from 'express';

export function corsFromEnv(): RequestHandler {
  const origin = process.env.CORS_ORIGIN;
  if (!origin) {
    return (_req, _res, next) => next();
  }

  return (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, x-admin-token');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  };
}
