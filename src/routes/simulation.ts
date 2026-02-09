import { Router } from 'express';
import type { Db } from '../db';
import { adminAuth } from '../adminAuth';
import { SimulationEngine, type Speed, type LogEntry } from '../simulation';

export function simulationRouter(db: Db) {
  const r = Router();
  r.use(adminAuth());

  let engine: SimulationEngine | null = null;

  const factoryCode = process.env.SEED_FACTORY_CODE ?? 'SOUTHERNIOT-DEMO';

  r.post('/start', async (req, res) => {
    if (engine && engine.getState().running) {
      return res.status(409).json({ ok: false, error: 'already_running' });
    }

    const speed: Speed = req.body?.speed === 'realistic' ? 'realistic' : 'fast';
    engine = new SimulationEngine(db, factoryCode, speed);

    // Start in background (don't await — it runs forever until stopped)
    engine.start().catch(() => { /* errors emitted via log */ });

    return res.json({ ok: true, speed });
  });

  r.post('/stop', async (_req, res) => {
    if (!engine || !engine.getState().running) {
      return res.json({ ok: true, stats: engine?.getStats() ?? null });
    }

    const stats = engine.stop();
    return res.json({ ok: true, stats });
  });

  r.get('/status', async (_req, res) => {
    if (!engine) {
      return res.json({ running: false, pipeline: [], currentBundle: 0, stats: { bundles: 0, pass: 0, fail: 0, rework: 0, events: 0 } });
    }
    return res.json(engine.getState());
  });

  // SSE stream of simulation log entries
  r.get('/log', async (req, res) => {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const writeEvent = (name: string, data: any) => {
      res.write(`event: ${name}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    writeEvent('hello', { ok: true, ts: new Date().toISOString() });

    let unsubscribe: (() => void) | null = null;

    const subscribe = () => {
      if (engine) {
        unsubscribe = engine.onLog((entry: LogEntry) => {
          writeEvent('log', entry);
        });
      }
    };

    subscribe();

    // Poll for engine changes (in case simulation starts after SSE connection)
    const checkTimer = setInterval(() => {
      if (engine && !unsubscribe) {
        subscribe();
      }
      // Send state updates periodically
      if (engine) {
        writeEvent('state', engine.getState());
      }
    }, 2000);

    const pingTimer = setInterval(() => writeEvent('ping', { ts: new Date().toISOString() }), 15000);

    req.on('close', () => {
      if (unsubscribe) unsubscribe();
      clearInterval(checkTimer);
      clearInterval(pingTimer);
    });
  });

  return r;
}
