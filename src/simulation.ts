import type { Db } from './db';
import { ulidLike, stationToken, tokenHash } from './ids';

// ── Types ───────────────────────────────────────────────────────────────────

export interface MappedStation {
  id: string;
  mac: string;
  station_id: string;
  line_id: string;
  line_name: string;
  type: string;
  token_hash: string;
}

export interface Stats {
  bundles: number;
  pass: number;
  fail: number;
  rework: number;
  events: number;
}

export interface LogEntry {
  ts: string;
  type: 'info' | 'bundle' | 'event' | 'qc_pass' | 'qc_fail' | 'rework' | 'done' | 'error' | 'stats';
  message: string;
  data?: Record<string, any>;
}

export type Speed = 'fast' | 'realistic';

// ── Data pools ──────────────────────────────────────────────────────────────

const STYLES = [
  { style: 'POLO-BLK-M', color: 'BLK', size: 'M' },
  { style: 'TEE-WHT-L', color: 'WHT', size: 'L' },
  { style: 'HOODIE-NVY-XL', color: 'NVY', size: 'XL' },
  { style: 'JOGGER-GRY-S', color: 'GRY', size: 'S' },
  { style: 'VEST-OLV-M', color: 'OLV', size: 'M' },
  { style: 'SHORTS-KHK-L', color: 'KHK', size: 'L' },
];

const QUANTITIES = [8, 10, 12, 15, 20];
const DEFECT_CODES = ['BROKEN_STITCH', 'SKIPPED_STITCH', 'UNEVEN_HEM', 'LOOSE_THREAD', 'MISALIGNED_SEAM', 'STAIN'];
const SEVERITIES = ['minor', 'major'];
const STATION_TYPE_ORDER = ['cutting', 'sewing', 'finishing', 'qc'] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randDelay(range: readonly [number, number]) {
  return randInt(range[0], range[1]);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randHex(bytes: number): string {
  const chars = '0123456789ABCDEF';
  let s = '';
  for (let i = 0; i < bytes * 2; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function ts(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m${rs > 0 ? rs + 's' : ''}`;
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    const onAbort = () => { clearTimeout(timer); resolve(); };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

// ── Simulation Engine ───────────────────────────────────────────────────────

export class SimulationEngine {
  private db: Db;
  private factoryCode: string;
  private speed: Speed;
  private ac: AbortController | null = null;
  private running = false;
  private pipeline: MappedStation[] = [];
  private bundleNum = 0;
  private orderCounter = 41;
  private stats: Stats = { bundles: 0, pass: 0, fail: 0, rework: 0, events: 0 };
  private logListeners: Set<(entry: LogEntry) => void> = new Set();

  private stepDelay: readonly [number, number];
  private bundleGap: readonly [number, number];

  constructor(db: Db, factoryCode: string, speed: Speed = 'fast') {
    this.db = db;
    this.factoryCode = factoryCode;
    this.speed = speed;
    this.stepDelay = speed === 'fast' ? [5_000, 10_000] : [30_000, 60_000];
    this.bundleGap = speed === 'fast' ? [3_000, 6_000] : [10_000, 20_000];
  }

  // ── Public API ──────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.running) throw new Error('already_running');

    this.ac = new AbortController();
    this.running = true;
    this.bundleNum = 0;
    this.orderCounter = 41;
    this.stats = { bundles: 0, pass: 0, fail: 0, rework: 0, events: 0 };

    try {
      // 1. Discover mapped stations
      const stations = await this.discoverStations();
      if (stations.length < 2) {
        this.emit({ ts: ts(), type: 'error', message: `Only ${stations.length} mapped station(s) found. Need at least 2.` });
        this.running = false;
        return;
      }

      // 2. Build pipeline
      this.pipeline = this.buildPipeline(stations);
      this.emit({
        ts: ts(), type: 'info',
        message: `Pipeline: ${this.pipeline.map(s => s.station_id).join(' → ')}`,
        data: { pipeline: this.pipeline.map(s => ({ station_id: s.station_id, type: s.type })) },
      });

      // 3. Re-claim to get fresh tokens
      await this.claimTokens(this.pipeline);
      this.emit({ ts: ts(), type: 'info', message: `Claimed tokens for ${this.pipeline.length} stations` });

      // 4. Start heartbeats
      this.startHeartbeats(this.pipeline, this.ac.signal);

      // 5. Run bundles continuously
      await this.runLoop(this.ac.signal);
    } catch (err: any) {
      if (!this.ac?.signal.aborted) {
        this.emit({ ts: ts(), type: 'error', message: err.message });
      }
    } finally {
      this.running = false;
      this.emit({ ts: ts(), type: 'stats', message: 'Simulation ended', data: { stats: { ...this.stats } } });
    }
  }

  stop(): Stats {
    if (this.ac) this.ac.abort();
    this.running = false;
    return { ...this.stats };
  }

  getStats(): Stats {
    return { ...this.stats };
  }

  getState() {
    return {
      running: this.running,
      pipeline: this.pipeline.map(s => ({ station_id: s.station_id, type: s.type })),
      currentBundle: this.bundleNum,
      stats: { ...this.stats },
    };
  }

  onLog(cb: (entry: LogEntry) => void): () => void {
    this.logListeners.add(cb);
    return () => { this.logListeners.delete(cb); };
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private emit(entry: LogEntry) {
    for (const cb of this.logListeners) {
      try { cb(entry); } catch { /* ignore */ }
    }
  }

  private async discoverStations(): Promise<MappedStation[]> {
    const f = await this.db.query('SELECT id FROM factories WHERE code = $1 LIMIT 1', [this.factoryCode]);
    const factoryId = f.rows[0]?.id;
    if (!factoryId) throw new Error(`Factory ${this.factoryCode} not found`);

    const q = await this.db.query(
      `SELECT s.id, s.mac, s.station_id, s.line_id, s.type, l.name as line_name
       FROM stations s
       LEFT JOIN lines l ON l.id = s.line_id
       WHERE s.factory_id = $1
         AND s.station_id IS NOT NULL
         AND s.line_id IS NOT NULL
         AND s.type IS NOT NULL`,
      [factoryId],
    );

    return q.rows.map((r: any) => ({
      id: r.id,
      mac: r.mac,
      station_id: r.station_id,
      line_id: r.line_id,
      line_name: r.line_name ?? '?',
      type: r.type,
      token_hash: '',
    }));
  }

  private async claimTokens(stations: MappedStation[]): Promise<void> {
    for (const st of stations) {
      const tok = stationToken();
      const hash = tokenHash(tok);
      await this.db.query(
        `UPDATE stations SET token_hash = $2, fw = 'demo-sim', updated_at = now() WHERE id = $1`,
        [st.id, hash],
      );
      st.token_hash = hash;
    }
  }

  private buildPipeline(stations: MappedStation[]): MappedStation[] {
    const byType = new Map<string, MappedStation[]>();
    for (const st of stations) {
      const arr = byType.get(st.type) ?? [];
      arr.push(st);
      byType.set(st.type, arr);
    }

    const pipeline: MappedStation[] = [];
    for (const type of STATION_TYPE_ORDER) {
      const group = byType.get(type);
      if (group) {
        group.sort((a, b) => a.station_id.localeCompare(b.station_id));
        pipeline.push(...group);
      }
    }
    return pipeline;
  }

  private async runLoop(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      this.bundleNum++;
      try {
        await this.runBundle(this.bundleNum, signal);
      } catch (err: any) {
        if (signal.aborted) break;
        this.emit({ ts: ts(), type: 'error', message: `Bundle #${this.bundleNum}: ${err.message}` });
      }
      if (signal.aborted) break;

      const gap = randDelay(this.bundleGap);
      await abortableSleep(gap, signal);
    }
  }

  private nextOrder(): string {
    return `PO-2026-${String(this.orderCounter++).padStart(4, '0')}`;
  }

  private async createBundle(bundleNum: number): Promise<{ bundleId: string; rfidUid: string; orderId: string; style: string; qty: number }> {
    const { style, color, size } = pick(STYLES);
    const qty = pick(QUANTITIES);
    const orderId = this.nextOrder();
    const rfidUid = randHex(7);

    const f = await this.db.query('SELECT id FROM factories WHERE code = $1 LIMIT 1', [this.factoryCode]);
    const factoryId = f.rows[0]?.id;
    if (!factoryId) throw new Error(`Factory ${this.factoryCode} not found`);

    const bundleId = ulidLike('bdl');
    await this.db.query(
      `INSERT INTO bundles (id, factory_id, order_id, style, color, size, qty, rfid_uid, status, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'created', now())`,
      [bundleId, factoryId, orderId, style, color, size, qty, rfidUid],
    );

    this.emit({
      ts: ts(), type: 'bundle',
      message: `Bundle #${bundleNum} | ${orderId} | ${style} | qty:${qty} | ${rfidUid}`,
      data: { bundleNum, orderId, style, qty, rfidUid, bundleId },
    });

    return { bundleId, rfidUid, orderId, style, qty };
  }

  private async postEvent(
    station: MappedStation,
    bundleId: string,
    factoryId: string,
    rfidUid: string,
    eventType: 'COMPLETE' | 'QC_PASS' | 'QC_FAIL',
    defects?: { code: string; qty: number; severity: string }[],
  ): Promise<void> {
    const eventId = `DEMO-${Date.now()}-${randHex(2)}`;
    const eventPk = ulidLike('evt');
    const meta = defects ? { sim: 'demo', defects } : { sim: 'demo' };
    const eventTs = new Date().toISOString();

    await this.db.query(
      `INSERT INTO events (id, factory_id, event_id, bundle_id, station_id, line_id, event_type, ts, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (station_id, event_id) DO NOTHING`,
      [eventPk, factoryId, eventId, bundleId, station.id, station.line_id, eventType, eventTs, JSON.stringify(meta)],
    );

    // Update bundle status
    const nextStatus = eventType === 'QC_PASS' ? 'qc_pass' : eventType === 'QC_FAIL' ? 'qc_fail' : 'in_progress';
    await this.db.query(
      `UPDATE bundles SET current_station_id = $2, current_line_id = $3, status = $4, updated_at = now() WHERE id = $1`,
      [bundleId, station.id, station.line_id, nextStatus],
    );
  }

  private async runBundle(bundleNum: number, signal: AbortSignal): Promise<void> {
    const bundle = await this.createBundle(bundleNum);
    this.stats.bundles++;

    // Resolve factory ID once
    const f = await this.db.query('SELECT id FROM factories WHERE code = $1 LIMIT 1', [this.factoryCode]);
    const factoryId = f.rows[0]?.id;

    const scenario = this.pickScenario();
    const nonQcStations = this.pipeline.filter(s => s.type !== 'qc');
    const qcStations = this.pipeline.filter(s => s.type === 'qc');
    const qcStation = qcStations.length > 0 ? pick(qcStations) : null;

    const startTime = Date.now();

    // Flow through non-QC stations
    for (const station of nonQcStations) {
      if (signal.aborted) return;

      const delay = randDelay(this.stepDelay);
      this.emit({
        ts: ts(), type: 'info',
        message: `${station.station_id} (${station.type}) ... ${fmtDuration(delay)}`,
        data: { station_id: station.station_id, stationType: station.type, delay },
      });

      await abortableSleep(delay, signal);
      if (signal.aborted) return;

      await this.postEvent(station, bundle.bundleId, factoryId, bundle.rfidUid, 'COMPLETE');
      this.stats.events++;
      this.emit({
        ts: ts(), type: 'event',
        message: `${station.station_id} COMPLETE`,
        data: { station_id: station.station_id, event_type: 'COMPLETE', rfidUid: bundle.rfidUid },
      });
    }

    // QC verdict
    if (qcStation) {
      if (signal.aborted) return;

      const delay = randDelay(this.stepDelay);
      this.emit({
        ts: ts(), type: 'info',
        message: `${qcStation.station_id} (qc) ... ${fmtDuration(delay)}`,
        data: { station_id: qcStation.station_id, stationType: 'qc', delay },
      });

      await abortableSleep(delay, signal);
      if (signal.aborted) return;

      if (scenario === 'pass') {
        await this.postEvent(qcStation, bundle.bundleId, factoryId, bundle.rfidUid, 'QC_PASS');
        this.stats.events++;
        this.stats.pass++;
        this.emit({
          ts: ts(), type: 'qc_pass',
          message: `${qcStation.station_id} QC_PASS`,
          data: { station_id: qcStation.station_id, event_type: 'QC_PASS', rfidUid: bundle.rfidUid },
        });
      } else {
        // QC_FAIL
        const defectCode = pick(DEFECT_CODES);
        const severity = pick(SEVERITIES);
        const defectQty = randInt(1, 3);
        await this.postEvent(qcStation, bundle.bundleId, factoryId, bundle.rfidUid, 'QC_FAIL', [
          { code: defectCode, qty: defectQty, severity },
        ]);
        this.stats.events++;
        this.stats.fail++;
        this.emit({
          ts: ts(), type: 'qc_fail',
          message: `${qcStation.station_id} QC_FAIL | ${defectCode} (${severity}, qty:${defectQty})`,
          data: { station_id: qcStation.station_id, event_type: 'QC_FAIL', defectCode, severity, defectQty, rfidUid: bundle.rfidUid },
        });

        // Rework scenario
        if (scenario === 'rework') {
          this.stats.rework++;
          this.emit({
            ts: ts(), type: 'rework',
            message: `Rework → back to sewing`,
            data: { rfidUid: bundle.rfidUid },
          });

          const sewingStations = nonQcStations.filter(s => s.type === 'sewing');
          for (const st of sewingStations) {
            if (signal.aborted) return;
            const d = randDelay(this.stepDelay);
            this.emit({
              ts: ts(), type: 'info',
              message: `${st.station_id} (rework) ... ${fmtDuration(d)}`,
              data: { station_id: st.station_id, stationType: st.type, delay: d, rework: true },
            });
            await abortableSleep(d, signal);
            if (signal.aborted) return;
            await this.postEvent(st, bundle.bundleId, factoryId, bundle.rfidUid, 'COMPLETE');
            this.stats.events++;
            this.emit({
              ts: ts(), type: 'event',
              message: `${st.station_id} COMPLETE (rework)`,
              data: { station_id: st.station_id, event_type: 'COMPLETE', rfidUid: bundle.rfidUid, rework: true },
            });
          }

          // Final QC pass after rework
          if (signal.aborted) return;
          const d = randDelay(this.stepDelay);
          this.emit({
            ts: ts(), type: 'info',
            message: `${qcStation.station_id} (qc re-check) ... ${fmtDuration(d)}`,
            data: { station_id: qcStation.station_id, stationType: 'qc', delay: d, rework: true },
          });
          await abortableSleep(d, signal);
          if (signal.aborted) return;
          await this.postEvent(qcStation, bundle.bundleId, factoryId, bundle.rfidUid, 'QC_PASS');
          this.stats.events++;
          this.emit({
            ts: ts(), type: 'qc_pass',
            message: `${qcStation.station_id} QC_PASS (after rework)`,
            data: { station_id: qcStation.station_id, event_type: 'QC_PASS', rfidUid: bundle.rfidUid, rework: true },
          });
        }
      }
    } else {
      this.stats.pass++;
    }

    const elapsed = fmtDuration(Date.now() - startTime);
    const outcome = scenario === 'rework' ? 'qc_pass (rework)' : scenario === 'pass' ? 'qc_pass' : 'qc_fail';
    this.emit({
      ts: ts(), type: 'done',
      message: `Bundle #${bundleNum} done | ${outcome} | ${elapsed}`,
      data: { bundleNum, outcome, elapsed, stats: { ...this.stats } },
    });
  }

  private pickScenario(): 'pass' | 'fail' | 'rework' {
    const roll = Math.random();
    if (roll < 0.70) return 'pass';
    if (roll < 0.90) return 'fail';
    return 'rework';
  }

  private startHeartbeats(stations: MappedStation[], signal: AbortSignal): void {
    const run = async () => {
      while (!signal.aborted) {
        for (const st of stations) {
          try {
            await this.db.query(
              `UPDATE stations SET last_seen_at = now(), updated_at = now() WHERE id = $1`,
              [st.id],
            );
          } catch { /* ignore heartbeat errors */ }
        }
        await abortableSleep(30_000, signal);
      }
    };
    run();
  }
}
