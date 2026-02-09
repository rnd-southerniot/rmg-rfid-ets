import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { createTestDb } from './helpers/testDb';
import { tokenHash } from '../src/ids';

async function seedFactoryAndLine(db: any) {
  await db.query('INSERT INTO factories (id, name, code) VALUES ($1,$2,$3)', ['fac_1', 'Demo', 'SOUTHERNIOT-DEMO']);
  await db.query('INSERT INTO lines (id, factory_id, name) VALUES ($1,$2,$3)', ['ln_1', 'fac_1', 'L1']);
}

describe('API acceptance (minimal)', () => {
  let pool: any;

  beforeEach(async () => {
    const t = await createTestDb();
    pool = t.pool;
  });

  it('POST /api/v1/bundles requires factory_code', async () => {
    await seedFactoryAndLine(pool);

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app).post('/api/v1/bundles').send({
      // factory_code intentionally missing
      order_id: 'ORD-1',
      style: 'STYLE',
      color: 'NAVY',
      size: 'L',
      qty: 10,
      line_route: ['CUT', 'SW', 'FIN', 'QC'],
      rfid_uid: 'E2000017221101441890ABCD'
    });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('invalid_request');
  });

  it('POST /api/v1/events → station_unmapped if station not mapped', async () => {
    await seedFactoryAndLine(pool);

    // station exists + token, but mapping nulls
    await pool.query(
      'INSERT INTO stations (id, factory_id, mac, station_id, line_id, type, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['st_1', 'fac_1', 'AA:BB:CC:DD:EE:FF', null, null, null, tokenHash('sttok_test')]
    );

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .post('/api/v1/events')
      .set('Authorization', 'Bearer sttok_test')
      .send({
        event_id: '01TEST',
        ts: '2026-02-05T11:04:00Z',
        bundle: { rfid_uid: 'E2000017221101441890ABCD' },
        event_type: 'COMPLETE'
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: 'station_unmapped' });
  });

  it('POST /api/v1/events → unknown_bundle if RFID not registered', async () => {
    await seedFactoryAndLine(pool);

    await pool.query(
      'INSERT INTO stations (id, factory_id, mac, station_id, line_id, type, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['st_1', 'fac_1', 'AA:BB:CC:DD:EE:FF', 'L1-SW-01', 'ln_1', 'sewing', tokenHash('sttok_test')]
    );

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .post('/api/v1/events')
      .set('Authorization', 'Bearer sttok_test')
      .send({
        event_id: '01TEST',
        ts: '2026-02-05T11:04:00Z',
        bundle: { rfid_uid: 'E2000017221101441890ABCD' },
        event_type: 'COMPLETE'
      });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: 'unknown_bundle' });
  });

  it('POST /api/v1/bundles normalizes lowercase rfid_uid to uppercase', async () => {
    await seedFactoryAndLine(pool);

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app).post('/api/v1/bundles').send({
      factory_code: 'SOUTHERNIOT-DEMO',
      order_id: 'ORD-1',
      style: 'STYLE',
      color: 'NAVY',
      size: 'L',
      qty: 10,
      rfid_uid: 'e2000017221101441890abcd'
    });

    expect(res.status).toBe(201);
    expect(res.body.rfid_uid).toBe('E2000017221101441890ABCD');

    // Lookup via lowercase param should also match
    const lookup = await request(app).get('/api/v1/bundles/by-rfid/e2000017221101441890abcd');
    expect(lookup.status).toBe(200);
    expect(lookup.body.bundle.rfid_uid).toBe('E2000017221101441890ABCD');
  });

  it('POST /api/v1/events normalizes lowercase rfid_uid', async () => {
    await seedFactoryAndLine(pool);

    await pool.query(
      'INSERT INTO stations (id, factory_id, mac, station_id, line_id, type, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['st_1', 'fac_1', 'AA:BB:CC:DD:EE:FF', 'L1-SW-01', 'ln_1', 'sewing', tokenHash('sttok_test')]
    );

    await pool.query(
      `INSERT INTO bundles (id, factory_id, order_id, style, color, size, qty, rfid_uid, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      ['bdl_1', 'fac_1', 'ORD-1', 'STYLE', 'NAVY', 'L', 10, 'E2000017221101441890ABCD', 'created']
    );

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .post('/api/v1/events')
      .set('Authorization', 'Bearer sttok_test')
      .send({
        event_id: '01NORM',
        ts: '2026-02-05T11:04:00Z',
        bundle: { rfid_uid: 'e2000017221101441890abcd' },
        event_type: 'COMPLETE'
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('7-byte UID: bundle create + event post works end-to-end', async () => {
    await seedFactoryAndLine(pool);

    const SEVEN_BYTE_UID = '04A1B2C3D4E5F6'; // 14 hex chars = 7 bytes

    await pool.query(
      'INSERT INTO stations (id, factory_id, mac, station_id, line_id, type, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['st_1', 'fac_1', 'AA:BB:CC:DD:EE:FF', 'L1-SW-01', 'ln_1', 'sewing', tokenHash('sttok_test')]
    );

    const app = createApp({ db: pool, logLevel: 'silent' });

    // Create bundle with 7-byte UID
    const create = await request(app).post('/api/v1/bundles').send({
      factory_code: 'SOUTHERNIOT-DEMO',
      order_id: 'ORD-7B',
      style: 'STYLE',
      color: 'RED',
      size: 'M',
      qty: 5,
      rfid_uid: SEVEN_BYTE_UID
    });
    expect(create.status).toBe(201);
    expect(create.body.rfid_uid).toBe(SEVEN_BYTE_UID);

    // Post event against that bundle
    const event = await request(app)
      .post('/api/v1/events')
      .set('Authorization', 'Bearer sttok_test')
      .send({
        event_id: '01SEVEN',
        ts: '2026-02-09T12:00:00Z',
        bundle: { rfid_uid: SEVEN_BYTE_UID },
        event_type: 'COMPLETE'
      });
    expect(event.status).toBe(200);
    expect(event.body.ok).toBe(true);
  });

  it('POST /api/v1/bundles rejects non-hex RFID UID', async () => {
    await seedFactoryAndLine(pool);

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app).post('/api/v1/bundles').send({
      factory_code: 'SOUTHERNIOT-DEMO',
      order_id: 'ORD-BAD',
      style: 'STYLE',
      color: 'NAVY',
      size: 'L',
      qty: 10,
      rfid_uid: 'GHIJKL123456'
    });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/v1/events is idempotent by (station_id,event_id)', async () => {
    await seedFactoryAndLine(pool);

    await pool.query(
      'INSERT INTO stations (id, factory_id, mac, station_id, line_id, type, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['st_1', 'fac_1', 'AA:BB:CC:DD:EE:FF', 'L1-SW-01', 'ln_1', 'sewing', tokenHash('sttok_test')]
    );

    await pool.query(
      `INSERT INTO bundles (id, factory_id, order_id, style, color, size, qty, rfid_uid, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      ['bdl_1', 'fac_1', 'ORD-1', 'STYLE', 'NAVY', 'L', 10, 'E2000017221101441890ABCD', 'created']
    );

    const app = createApp({ db: pool, logLevel: 'silent' });

    const payload = {
      event_id: '01DUP',
      ts: '2026-02-05T11:04:00Z',
      bundle: { rfid_uid: 'E2000017221101441890ABCD' },
      event_type: 'COMPLETE',
      meta: { rssi: -55 }
    };

    const r1 = await request(app).post('/api/v1/events').set('Authorization', 'Bearer sttok_test').send(payload);
    const r2 = await request(app).post('/api/v1/events').set('Authorization', 'Bearer sttok_test').send(payload);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const ev = await pool.query('SELECT * FROM events WHERE station_id = $1 AND event_id = $2', ['st_1', '01DUP']);
    expect(ev.rowCount).toBe(1);

    const b = await pool.query('SELECT status, current_station_id, current_line_id FROM bundles WHERE id = $1', ['bdl_1']);
    expect(b.rows[0].status).toBe('in_progress');
    expect(b.rows[0].current_station_id).toBe('st_1');
    expect(b.rows[0].current_line_id).toBe('ln_1');
  });
});
