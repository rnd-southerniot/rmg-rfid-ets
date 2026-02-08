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

export function createApp(opts: { db: Db; logLevel?: string }) {
  const app = express();
  const logger = pino({ level: opts.logLevel ?? 'info' });

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

  app.use('/api/v1/stations', stationsRouter(opts.db));
  app.use('/api/v1/station', stationStatusRouter(opts.db));
  app.use('/api/v1/events', eventsRouter(opts.db));
  app.use('/api/v1/bundles', bundlesRouter(opts.db));
  app.use('/api/v1/admin', adminRouter(opts.db));
  app.use('/api/v1/admin/events', adminEventsRouter(opts.db));
  app.use('/api/v1/admin/bundles', adminBundlesRouter(opts.db));

  // basic error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ ok: false, error: 'internal_error' });
  });

  return app;
}
