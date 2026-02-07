import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { createTestDb } from './helpers/testDb';
import { tokenHash } from '../src/ids';

async function seedFactoryLineAndBundle(db: any) {
  await db.query('INSERT INTO factories (id, name, code) VALUES ($1,$2,$3)', ['fac_1', 'Demo', 'SOUTHERNIOT-DEMO']);
  await db.query('INSERT INTO lines (id, factory_id, name) VALUES ($1,$2,$3)', ['ln_1', 'fac_1', 'L1']);
  await db.query(
    `INSERT INTO bundles (id, factory_id, order_id, style, color, size, qty, rfid_uid, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    ['bdl_1', 'fac_1', 'ORD-1', 'STYLE', 'NAVY', 'L', 10, 'E2000017221101441890ABCD', 'created']
  );
}

describe('Station type vs event type rules', () => {
  let pool: any;

  beforeEach(async () => {
    const t = await createTestDb();
    pool = t.pool;
  });

  it('non-qc station cannot post QC_PASS', async () => {
    await seedFactoryLineAndBundle(pool);

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
        event_type: 'QC_PASS'
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: 'station_type_mismatch' });
  });

  it('qc station cannot post COMPLETE', async () => {
    await seedFactoryLineAndBundle(pool);

    await pool.query(
      'INSERT INTO stations (id, factory_id, mac, station_id, line_id, type, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['st_1', 'fac_1', 'AA:BB:CC:DD:EE:FF', 'L1-QC-01', 'ln_1', 'qc', tokenHash('sttok_test')]
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
    expect(res.body).toEqual({ ok: false, error: 'station_type_mismatch' });
  });

  it('qc station can post QC_FAIL', async () => {
    await seedFactoryLineAndBundle(pool);

    await pool.query(
      'INSERT INTO stations (id, factory_id, mac, station_id, line_id, type, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['st_1', 'fac_1', 'AA:BB:CC:DD:EE:FF', 'L1-QC-01', 'ln_1', 'qc', tokenHash('sttok_test')]
    );

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .post('/api/v1/events')
      .set('Authorization', 'Bearer sttok_test')
      .send({
        event_id: '01TEST',
        ts: '2026-02-05T11:04:00Z',
        bundle: { rfid_uid: 'E2000017221101441890ABCD' },
        event_type: 'QC_FAIL',
        defects: [{ code: 'STITCH_SKIP', qty: 1 }]
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
