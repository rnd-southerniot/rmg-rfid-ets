import path from 'node:path';
import express from 'express';
import pinoHttp from 'pino-http';
import pino from 'pino';
import type { Db } from './db';
import { corsFromEnv } from './cors';
import { stationsRouter } from './routes/stations';
import { eventsRouter } from './routes/events';
import { bundlesRouter } from './routes/bundles';
import { adminRouter } from './routes/admin';
import { adminEventsRouter } from './routes/adminEvents';
import { stationStatusRouter } from './routes/stationStatus';
import { adminBundlesRouter } from './routes/adminBundles';
import { simulationRouter } from './routes/simulation';
import { authRouter } from './routes/auth';

export function createApp(opts: {
  db: Db;
  logLevel?: string;
  jwtSecret?: string;
  loginRfidUids?: string[];
}) {
  const app = express();
  const logger = pino({ level: opts.logLevel ?? 'info' });
  const jwtSecret = opts.jwtSecret ?? 'test-jwt-secret-default-do-not-use-in-prod';
  const loginRfidUids = opts.loginRfidUids?.length
    ? opts.loginRfidUids
    : ['TESTLOGINUID'];

  app.use(pinoHttp({ logger }));
  app.use(corsFromEnv());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', async (_req, res) => {
    try {
      await opts.db.query('SELECT 1');
      return res.json({ ok: true });
    } catch {
      return res.status(503).json({ ok: false, error: 'db_unreachable' });
    }
  });

  app.use('/api/v1/auth', authRouter(opts.db, { jwtSecret, loginRfidUids }));
  app.use('/api/v1/stations', stationsRouter(opts.db));
  app.use('/api/v1/station', stationStatusRouter(opts.db));
  app.use('/api/v1/events', eventsRouter(opts.db, { jwtSecret, loginRfidUids }));
  app.use('/api/v1/bundles', bundlesRouter(opts.db));
  app.use('/api/v1/admin', adminRouter(opts.db));
  app.use('/api/v1/admin/events', adminEventsRouter(opts.db));
  app.use('/api/v1/admin/bundles', adminBundlesRouter(opts.db));
  app.use('/api/v1/simulation', simulationRouter(opts.db));

  // Serve demo dashboard
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('/demo', (_req, res) => res.redirect('/demo.html'));

  // basic error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ ok: false, error: 'internal_error' });
  });

  return app;
}
