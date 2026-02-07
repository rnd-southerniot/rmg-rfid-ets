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

export function createApp(opts: { db: Db; logLevel?: string }) {
  const app = express();
  const logger = pino({ level: opts.logLevel ?? 'info' });

  app.use(pinoHttp({ logger }));
  app.use(corsFromEnv());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/v1/stations', stationsRouter(opts.db));
  app.use('/api/v1/station', stationStatusRouter(opts.db));
  app.use('/api/v1/events', eventsRouter(opts.db));
  app.use('/api/v1/bundles', bundlesRouter(opts.db));
  app.use('/api/v1/admin', adminRouter(opts.db));
  app.use('/api/v1/admin/events', adminEventsRouter(opts.db));

  // basic error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ ok: false, error: 'internal_error' });
  });

  return app;
}
