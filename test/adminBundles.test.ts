import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { createTestDb } from './helpers/testDb';
import { tokenHash } from '../src/ids';

async function seedFactoryAndLine(db: any) {
  await db.query('INSERT INTO factories (id, name, code) VALUES ($1,$2,$3)', ['fac_1', 'Demo', 'SOUTHERNIOT-DEMO']);
  await db.query('INSERT INTO lines (id, factory_id, name) VALUES ($1,$2,$3)', ['ln_1', 'fac_1', 'L1']);
}

async function seedBundle(db: any, id: string, rfid: string, opts?: { status?: string; order_id?: string }) {
  await db.query(
    `INSERT INTO bundles (id, factory_id, order_id, style, color, size, qty, rfid_uid, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, 'fac_1', opts?.order_id ?? 'ORD-1', 'STYLE', 'NAVY', 'L', 10, rfid, opts?.status ?? 'created']
  );
}

describe('Admin bundles API', () => {
  let pool: any;

  beforeEach(async () => {
    process.env.ADMIN_TOKEN = 'admintok';
    const t = await createTestDb();
    pool = t.pool;
  });

  it('GET /api/v1/admin/bundles requires admin auth', async () => {
    await seedFactoryAndLine(pool);

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app).get('/api/v1/admin/bundles?factory_code=SOUTHERNIOT-DEMO');

    expect(res.status).toBe(401);
  });

  it('GET /api/v1/admin/bundles lists bundles for factory', async () => {
    await seedFactoryAndLine(pool);
    await seedBundle(pool, 'bdl_1', 'RFID001');
    await seedBundle(pool, 'bdl_2', 'RFID002');

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .get('/api/v1/admin/bundles?factory_code=SOUTHERNIOT-DEMO')
      .set('x-admin-token', 'admintok');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.bundles).toHaveLength(2);
  });

  it('GET /api/v1/admin/bundles filters by status', async () => {
    await seedFactoryAndLine(pool);
    await seedBundle(pool, 'bdl_1', 'RFID001', { status: 'created' });
    await seedBundle(pool, 'bdl_2', 'RFID002', { status: 'in_progress' });

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .get('/api/v1/admin/bundles?factory_code=SOUTHERNIOT-DEMO&status=in_progress')
      .set('x-admin-token', 'admintok');

    expect(res.status).toBe(200);
    expect(res.body.bundles).toHaveLength(1);
    expect(res.body.bundles[0].status).toBe('in_progress');
  });

  it('GET /api/v1/admin/bundles filters by rfid_uid partial match', async () => {
    await seedFactoryAndLine(pool);
    await seedBundle(pool, 'bdl_1', 'E2000017221101441890AAAA');
    await seedBundle(pool, 'bdl_2', 'E2000017221101441890BBBB');

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .get('/api/v1/admin/bundles?factory_code=SOUTHERNIOT-DEMO&rfid_uid=AAAA')
      .set('x-admin-token', 'admintok');

    expect(res.status).toBe(200);
    expect(res.body.bundles).toHaveLength(1);
    expect(res.body.bundles[0].rfid_uid).toBe('E2000017221101441890AAAA');
  });

  it('GET /api/v1/admin/bundles supports pagination', async () => {
    await seedFactoryAndLine(pool);
    await seedBundle(pool, 'bdl_1', 'RFID001');
    await seedBundle(pool, 'bdl_2', 'RFID002');
    await seedBundle(pool, 'bdl_3', 'RFID003');

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .get('/api/v1/admin/bundles?factory_code=SOUTHERNIOT-DEMO&limit=2&offset=0')
      .set('x-admin-token', 'admintok');

    expect(res.status).toBe(200);
    expect(res.body.bundles).toHaveLength(2);

    const res2 = await request(app)
      .get('/api/v1/admin/bundles?factory_code=SOUTHERNIOT-DEMO&limit=2&offset=2')
      .set('x-admin-token', 'admintok');

    expect(res2.status).toBe(200);
    expect(res2.body.bundles).toHaveLength(1);
  });

  it('GET /api/v1/admin/bundles/:id/events returns chronological timeline', async () => {
    await seedFactoryAndLine(pool);
    await seedBundle(pool, 'bdl_1', 'RFID001');

    await pool.query(
      'INSERT INTO stations (id, factory_id, mac, station_id, line_id, type, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['st_1', 'fac_1', 'AA:BB:CC:DD:EE:FF', 'L1-SW-01', 'ln_1', 'sewing', tokenHash('sttok_test')]
    );

    // Insert two events with different timestamps
    await pool.query(
      `INSERT INTO events (id, factory_id, event_id, bundle_id, station_id, line_id, event_type, ts)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      ['evt_2', 'fac_1', 'E02', 'bdl_1', 'st_1', 'ln_1', 'COMPLETE', '2026-02-05T12:00:00Z']
    );
    await pool.query(
      `INSERT INTO events (id, factory_id, event_id, bundle_id, station_id, line_id, event_type, ts)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      ['evt_1', 'fac_1', 'E01', 'bdl_1', 'st_1', 'ln_1', 'COMPLETE', '2026-02-05T11:00:00Z']
    );

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .get('/api/v1/admin/bundles/bdl_1/events')
      .set('x-admin-token', 'admintok');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.bundle_id).toBe('bdl_1');
    expect(res.body.events).toHaveLength(2);
    // Chronological order (ASC)
    expect(res.body.events[0].event_id).toBe('E01');
    expect(res.body.events[1].event_id).toBe('E02');
  });

  it('GET /api/v1/admin/bundles/:id/events returns 404 for missing bundle', async () => {
    await seedFactoryAndLine(pool);

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .get('/api/v1/admin/bundles/bdl_nonexistent/events')
      .set('x-admin-token', 'admintok');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: 'not_found' });
  });

  it('GET /api/v1/admin/bundles/:id/events returns empty array when no events', async () => {
    await seedFactoryAndLine(pool);
    await seedBundle(pool, 'bdl_1', 'RFID001');

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .get('/api/v1/admin/bundles/bdl_1/events')
      .set('x-admin-token', 'admintok');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.events).toHaveLength(0);
  });
});
