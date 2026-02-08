import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { createTestDb } from './helpers/testDb';

async function seedFactoryAndLine(db: any) {
  await db.query('INSERT INTO factories (id, name, code) VALUES ($1,$2,$3)', ['fac_1', 'Demo', 'SOUTHERNIOT-DEMO']);
  await db.query('INSERT INTO lines (id, factory_id, name) VALUES ($1,$2,$3)', ['ln_1', 'fac_1', 'L1']);
}

function makeBundle(rfid: string, overrides?: Record<string, any>) {
  return {
    factory_code: 'SOUTHERNIOT-DEMO',
    order_id: 'ORD-1',
    style: 'STYLE',
    color: 'NAVY',
    size: 'L',
    qty: 10,
    rfid_uid: rfid,
    ...overrides
  };
}

describe('Bulk bundle creation', () => {
  let pool: any;

  beforeEach(async () => {
    const t = await createTestDb();
    pool = t.pool;
  });

  it('POST /api/v1/bundles/bulk creates multiple bundles', async () => {
    await seedFactoryAndLine(pool);

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .post('/api/v1/bundles/bulk')
      .send({
        bundles: [
          makeBundle('RFID001'),
          makeBundle('RFID002'),
          makeBundle('RFID003')
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary).toEqual({ total: 3, succeeded: 3, failed: 0 });
    expect(res.body.results).toHaveLength(3);
    expect(res.body.results.every((r: any) => r.success)).toBe(true);
    expect(res.body.results.every((r: any) => r.bundle_id)).toBe(true);
  });

  it('POST /api/v1/bundles/bulk handles partial failure on duplicate RFIDs', async () => {
    await seedFactoryAndLine(pool);

    // Pre-create a bundle with RFID001
    await pool.query(
      `INSERT INTO bundles (id, factory_id, order_id, style, color, size, qty, rfid_uid, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      ['bdl_existing', 'fac_1', 'ORD-1', 'STYLE', 'NAVY', 'L', 10, 'RFID001', 'created']
    );

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .post('/api/v1/bundles/bulk')
      .send({
        bundles: [
          makeBundle('RFID001'), // duplicate — should fail
          makeBundle('RFID002'), // should succeed
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary).toEqual({ total: 2, succeeded: 1, failed: 1 });
    expect(res.body.results[0].success).toBe(false);
    expect(res.body.results[0].error).toBe('rfid_already_assigned');
    expect(res.body.results[1].success).toBe(true);
  });

  it('POST /api/v1/bundles/bulk rejects invalid payload', async () => {
    await seedFactoryAndLine(pool);

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .post('/api/v1/bundles/bulk')
      .send({ bundles: [] });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('invalid_request');
  });

  it('POST /api/v1/bundles/bulk normalizes rfid_uid to uppercase', async () => {
    await seedFactoryAndLine(pool);

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .post('/api/v1/bundles/bulk')
      .send({
        bundles: [makeBundle('rfid_lowercase_001')]
      });

    expect(res.status).toBe(201);
    expect(res.body.results[0].success).toBe(true);

    // Verify it was stored uppercase
    const q = await pool.query('SELECT rfid_uid FROM bundles WHERE id = $1', [res.body.results[0].bundle_id]);
    expect(q.rows[0].rfid_uid).toBe('RFID_LOWERCASE_001');
  });

  it('POST /api/v1/bundles/bulk reports unknown_factory per item', async () => {
    await seedFactoryAndLine(pool);

    const app = createApp({ db: pool, logLevel: 'silent' });
    const res = await request(app)
      .post('/api/v1/bundles/bulk')
      .send({
        bundles: [
          makeBundle('RFID001', { factory_code: 'NONEXISTENT' }),
          makeBundle('RFID002')
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.summary).toEqual({ total: 2, succeeded: 1, failed: 1 });
    expect(res.body.results[0].success).toBe(false);
    expect(res.body.results[0].error).toBe('unknown_factory');
    expect(res.body.results[1].success).toBe(true);
  });
});
