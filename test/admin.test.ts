import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { createTestDb } from './helpers/testDb';
import { tokenHash } from '../src/ids';

async function seedFactoryAndLine(db: any) {
  await db.query('INSERT INTO factories (id, name, code) VALUES ($1,$2,$3)', ['fac_1', 'Demo', 'SOUTHERNIOT-DEMO']);
  await db.query('INSERT INTO lines (id, factory_id, name) VALUES ($1,$2,$3)', ['ln_1', 'fac_1', 'L1']);
}

describe('Admin API (minimal)', () => {
  let pool: any;

  beforeEach(async () => {
    process.env.ADMIN_TOKEN = 'admintok';
    const t = await createTestDb();
    pool = t.pool;
  });

  it('GET /api/v1/admin/stations requires x-admin-token', async () => {
    await seedFactoryAndLine(pool);

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app).get('/api/v1/admin/stations?factory_code=SOUTHERNIOT-DEMO');

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('PATCH /api/v1/admin/stations/:id/map maps station and enables event ingest', async () => {
    await seedFactoryAndLine(pool);

    // station claimed but unmapped
    await pool.query(
      'INSERT INTO stations (id, factory_id, mac, station_id, line_id, type, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['st_1', 'fac_1', 'AA:BB:CC:DD:EE:FF', null, null, null, 'hash']
    );

    const app = createApp({ db: pool, logLevel: 'silent' });

    const mapRes = await request(app)
      .patch('/api/v1/admin/stations/st_1/map')
      .set('x-admin-token', 'admintok')
      .send({ station_id: 'L1-SW-01', line_name: 'L1', type: 'sewing' });

    expect(mapRes.status).toBe(200);
    expect(mapRes.body.ok).toBe(true);
    expect(mapRes.body.station.station_id).toBe('L1-SW-01');
    expect(mapRes.body.station.type).toBe('sewing');
  });

  it('PATCH /api/v1/admin/stations/:id/map rejects duplicate station_id within factory', async () => {
    await seedFactoryAndLine(pool);

    await pool.query(
      'INSERT INTO stations (id, factory_id, mac, station_id, line_id, type, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['st_1', 'fac_1', 'AA:BB:CC:DD:EE:01', 'L1-SW-01', 'ln_1', 'sewing', 'hash1']
    );
    await pool.query(
      'INSERT INTO stations (id, factory_id, mac, station_id, line_id, type, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['st_2', 'fac_1', 'AA:BB:CC:DD:EE:02', null, null, null, 'hash2']
    );

    const app = createApp({ db: pool, logLevel: 'silent' });

    const mapRes = await request(app)
      .patch('/api/v1/admin/stations/st_2/map')
      .set('x-admin-token', 'admintok')
      .send({ station_id: 'L1-SW-01', line_name: 'L1', type: 'sewing' });

    expect(mapRes.status).toBe(409);
    expect(mapRes.body).toEqual({ ok: false, error: 'station_id_taken' });
  });

  it('PATCH /api/v1/admin/stations/:id/unmap clears mapping fields', async () => {
    await seedFactoryAndLine(pool);

    // station mapped
    await pool.query(
      'INSERT INTO stations (id, factory_id, mac, station_id, line_id, type, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['st_1', 'fac_1', 'AA:BB:CC:DD:EE:FF', 'L1-SW-01', 'ln_1', 'sewing', 'hash']
    );

    const app = createApp({ db: pool, logLevel: 'silent' });

    const res = await request(app)
      .patch('/api/v1/admin/stations/st_1/unmap')
      .set('x-admin-token', 'admintok');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.station.station_id).toBeNull();
    expect(res.body.station.line_id).toBeNull();
    expect(res.body.station.type).toBeNull();
  });

  it('PATCH /api/v1/admin/stations/:id/unmap returns 404 for missing station', async () => {
    await seedFactoryAndLine(pool);

    const app = createApp({ db: pool, logLevel: 'silent' });

    const res = await request(app)
      .patch('/api/v1/admin/stations/st_nonexistent/unmap')
      .set('x-admin-token', 'admintok');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: 'not_found' });
  });

  it('unmapped station causes station_unmapped on event ingest', async () => {
    await seedFactoryAndLine(pool);

    await pool.query(
      'INSERT INTO stations (id, factory_id, mac, station_id, line_id, type, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['st_1', 'fac_1', 'AA:BB:CC:DD:EE:FF', 'L1-SW-01', 'ln_1', 'sewing', tokenHash('sttok_test')]
    );

    const app = createApp({ db: pool, logLevel: 'silent' });

    // Unmap the station
    const unmapRes = await request(app)
      .patch('/api/v1/admin/stations/st_1/unmap')
      .set('x-admin-token', 'admintok');
    expect(unmapRes.status).toBe(200);

    // Try to ingest event — should fail because station is now unmapped
    const eventRes = await request(app)
      .post('/api/v1/events')
      .set('Authorization', 'Bearer sttok_test')
      .send({
        event_id: '01TEST',
        ts: '2026-02-05T11:04:00Z',
        bundle: { rfid_uid: 'E2000017221101441890ABCD' },
        event_type: 'COMPLETE'
      });

    expect(eventRes.status).toBe(409);
    expect(eventRes.body).toEqual({ ok: false, error: 'station_unmapped' });
  });
});
