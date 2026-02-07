import type { RequestHandler } from 'express';

export function adminAuth(): RequestHandler {
  const adminToken = process.env.ADMIN_TOKEN;

  return async (req, res, next) => {
    // If no admin token configured, keep admin endpoints locked down.
    if (!adminToken) {
      return res.status(503).json({ ok: false, error: 'admin_not_configured' });
    }

    const hdr = req.header('x-admin-token') || '';
    const qtok = typeof req.query?.admin_token === 'string' ? req.query.admin_token : '';
    const tok = hdr || qtok;

    if (!tok || tok !== adminToken) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    next();
  };
}
