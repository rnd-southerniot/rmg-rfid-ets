import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { createTestDb } from './helpers/testDb';

describe('Health check', () => {
  let pool: any;

  beforeEach(async () => {
    const t = await createTestDb();
    pool = t.pool;
  });

  it('GET /health returns ok:true when DB is reachable', async () => {
    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
