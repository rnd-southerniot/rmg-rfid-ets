import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { createTestDb } from './helpers/testDb';
import { tokenHash } from '../src/ids';

async function seedFactoryAndLine(db: any) {
  await db.query('INSERT INTO factories (id, name, code) VALUES ($1,$2,$3)', ['fac_1', 'Demo', 'SOUTHERNIOT-DEMO']);
  await db.query('INSERT INTO lines (id, factory_id, name) VALUES ($1,$2,$3)', ['ln_1', 'fac_1', 'L1']);
}

describe('Station heartbeat', () => {
  let pool: any;

  beforeEach(async () => {
    const t = await createTestDb();
    pool = t.pool;
  });

  it('POST /api/v1/station/heartbeat sets last_seen_at', async () => {
    await seedFactoryAndLine(pool);

    await pool.query(
      'INSERT INTO stations (id, factory_id, mac, station_id, line_id, type, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['st_1', 'fac_1', 'AA:BB:CC:DD:EE:FF', 'L1-SW-01', 'ln_1', 'sewing', tokenHash('sttok_test')]
    );

    const app = createApp({ db: pool, logLevel: 'silent' });

    const hb = await request(app)
      .post('/api/v1/station/heartbeat')
      .set('Authorization', 'Bearer sttok_test')
      .send({ ts: '2026-02-06T17:10:00Z' });

    expect(hb.status).toBe(200);
    expect(hb.body).toEqual({ ok: true });

    const q = await pool.query('SELECT last_seen_at FROM stations WHERE id = $1', ['st_1']);
    expect(q.rows[0].last_seen_at).toBeTruthy();
  });
});
