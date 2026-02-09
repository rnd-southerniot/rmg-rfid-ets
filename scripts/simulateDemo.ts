import 'dotenv/config';

// ── Config ──────────────────────────────────────────────────────────────────

const API = process.env.API_BASE ?? `http://127.0.0.1:${process.env.PORT ?? '3003'}`;
const _adminToken = process.env.ADMIN_TOKEN;
const FACTORY_CODE = process.env.SEED_FACTORY_CODE ?? 'SOUTHERNIOT-DEMO';
const SPEED = process.env.SIM_SPEED ?? 'realistic'; // 'fast' | 'realistic'

if (!_adminToken) {
  console.error('ADMIN_TOKEN is required in .env for simulation');
  process.exit(1);
}
const ADMIN_TOKEN: string = _adminToken;

// Timing (ms)
const STEP_DELAY = SPEED === 'fast' ? [5_000, 10_000] as const : [30_000, 60_000] as const;
const BUNDLE_GAP = SPEED === 'fast' ? [3_000, 6_000] as const : [10_000, 20_000] as const;
const HEARTBEAT_INTERVAL = 30_000;

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

// ── HTTP ────────────────────────────────────────────────────────────────────

async function jfetch(path: string, opts: RequestInit & { json?: any } = {}): Promise<any> {
  const headers: Record<string, string> = { ...(opts.headers as any) };
  if (opts.json !== undefined) headers['content-type'] = 'application/json';

  const res = await fetch(API + path, {
    ...opts,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${path}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

function adminHeaders(): Record<string, string> {
  return { 'x-admin-token': ADMIN_TOKEN };
}

function stationHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

// ── Types ───────────────────────────────────────────────────────────────────

interface MappedStation {
  id: string;           // internal PK
  mac: string;
  station_id: string;   // human-readable e.g. L1-SW-01
  line_id: string;
  line_name: string;
  type: string;         // cutting | sewing | finishing | qc
  token: string;        // bearer token (filled after re-claim)
}

interface Stats {
  bundles: number;
  pass: number;
  fail: number;
  rework: number;
  events: number;
}

// ── Discovery & Setup ───────────────────────────────────────────────────────

async function discoverStations(): Promise<MappedStation[]> {
  const res = await jfetch(`/api/v1/admin/stations?factory_code=${encodeURIComponent(FACTORY_CODE)}`, {
    headers: adminHeaders(),
  });

  const mapped: MappedStation[] = (res.stations as any[])
    .filter((s: any) => s.station_id && s.line_id && s.type)
    .map((s: any) => ({
      id: s.id,
      mac: s.mac,
      station_id: s.station_id,
      line_id: s.line_id,
      line_name: s.line_name ?? '?',
      type: s.type,
      token: '', // filled later
    }));

  return mapped;
}

async function claimTokens(stations: MappedStation[]): Promise<void> {
  for (const st of stations) {
    const res = await jfetch('/api/v1/stations/claim', {
      method: 'POST',
      json: { factory_code: FACTORY_CODE, mac: st.mac, fw: 'demo-sim', capabilities: { sim: true } },
    });
    st.token = res.token;
  }
}

function buildPipeline(stations: MappedStation[]): MappedStation[] {
  // Sort by type order, then station_id within type
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

// ── Console Output ──────────────────────────────────────────────────────────

function printBanner(pipeline: MappedStation[], lineName: string) {
  const pipeStr = pipeline.map((s) => s.station_id).join(' \u2192 ');
  const speedLabel = SPEED === 'fast' ? 'fast (5-10s)' : 'realistic (30-60s)';
  const w = 64;
  const line = (s: string) => `\u2551  ${s.padEnd(w - 4)}  \u2551`;

  console.log(`\u2554${'═'.repeat(w)}\u2557`);
  console.log(line('RMG RFID \u2014 Live Sewing Line Simulation'));
  console.log(line(`Factory: ${FACTORY_CODE}  \u2502  Line: ${lineName}`));
  console.log(line(`Pipeline: ${pipeStr}`));
  console.log(line(`Speed: ${speedLabel}  \u2502  Ctrl+C to stop`));
  console.log(`\u255A${'═'.repeat(w)}\u255D`);
  console.log();
}

function printStats(stats: Stats) {
  console.log();
  console.log(`\u2500\u2500 Stats ${'─'.repeat(55)}`);
  console.log(`  Bundles: ${stats.bundles} \u2502 Pass: ${stats.pass} \u2502 Fail: ${stats.fail} \u2502 Rework: ${stats.rework} \u2502 Events: ${stats.events}`);
  console.log('─'.repeat(63));
}

// ── Bundle Processing ───────────────────────────────────────────────────────

let orderCounter = 41;

function nextOrder(): string {
  return `PO-2026-${String(orderCounter++).padStart(4, '0')}`;
}

async function createBundle(factoryCode: string, bundleNum: number): Promise<{ bundleId: string; rfidUid: string; orderId: string; style: string; qty: number }> {
  const { style, color, size } = pick(STYLES);
  const qty = pick(QUANTITIES);
  const orderId = nextOrder();
  // 7-byte RFID UID (14 hex chars) — showcases cascade support
  const rfidUid = randHex(7);

  const res = await jfetch('/api/v1/bundles', {
    method: 'POST',
    json: {
      factory_code: factoryCode,
      order_id: orderId,
      style,
      color,
      size,
      qty,
      rfid_uid: rfidUid,
    },
  });

  console.log(`[${ts()}] \u25CF Bundle #${bundleNum} \u2502 ${orderId} \u2502 ${style} \u2502 qty:${qty} \u2502 ${rfidUid}`);
  return { bundleId: res.bundle_id, rfidUid, orderId, style, qty };
}

async function postEvent(
  station: MappedStation,
  rfidUid: string,
  eventType: 'COMPLETE' | 'QC_PASS' | 'QC_FAIL',
  defects?: { code: string; qty: number; severity: string }[],
): Promise<void> {
  const eventId = `DEMO-${Date.now()}-${randHex(2)}`;

  await jfetch('/api/v1/events', {
    method: 'POST',
    headers: stationHeaders(station.token),
    json: {
      event_id: eventId,
      ts: new Date().toISOString(),
      bundle: { rfid_uid: rfidUid },
      event_type: eventType,
      ...(defects ? { defects } : {}),
      meta: { sim: 'demo' },
    },
  });
}

type Scenario = 'pass' | 'fail' | 'rework';

function pickScenario(): Scenario {
  const roll = Math.random();
  if (roll < 0.70) return 'pass';
  if (roll < 0.90) return 'fail';
  return 'rework';
}

async function runBundle(
  bundleNum: number,
  pipeline: MappedStation[],
  stats: Stats,
  signal: AbortSignal,
): Promise<void> {
  const bundle = await createBundle(FACTORY_CODE, bundleNum);
  stats.bundles++;

  const scenario = pickScenario();
  const nonQcStations = pipeline.filter((s) => s.type !== 'qc');
  const qcStations = pipeline.filter((s) => s.type === 'qc');
  const qcStation = qcStations.length > 0 ? pick(qcStations) : null;

  const startTime = Date.now();

  // Flow through non-QC stations
  for (const station of nonQcStations) {
    if (signal.aborted) return;

    const delay = randDelay(STEP_DELAY);
    console.log(`[${ts()}]   \u25F7 ${station.station_id} (${station.type}) ... ${fmtDuration(delay)}`);

    await abortableSleep(delay, signal);
    if (signal.aborted) return;

    await postEvent(station, bundle.rfidUid, 'COMPLETE');
    stats.events++;
    console.log(`[${ts()}]   \u2713 ${station.station_id} COMPLETE`);
  }

  // QC verdict
  if (qcStation) {
    if (signal.aborted) return;

    const delay = randDelay(STEP_DELAY);
    console.log(`[${ts()}]   \u25F7 ${qcStation.station_id} (qc) ... ${fmtDuration(delay)}`);

    await abortableSleep(delay, signal);
    if (signal.aborted) return;

    if (scenario === 'pass') {
      await postEvent(qcStation, bundle.rfidUid, 'QC_PASS');
      stats.events++;
      stats.pass++;
      console.log(`[${ts()}]   \u2713 ${qcStation.station_id} QC_PASS`);
    } else {
      // QC_FAIL
      const defectCode = pick(DEFECT_CODES);
      const severity = pick(SEVERITIES);
      const defectQty = randInt(1, 3);
      await postEvent(qcStation, bundle.rfidUid, 'QC_FAIL', [
        { code: defectCode, qty: defectQty, severity },
      ]);
      stats.events++;
      stats.fail++;
      console.log(`[${ts()}]   \u2717 ${qcStation.station_id} QC_FAIL \u2502 ${defectCode} (${severity}, qty:${defectQty})`);

      // Rework scenario: re-scan through sewing → QC_PASS
      if (scenario === 'rework') {
        console.log(`[${ts()}]   \u21A9 Rework \u2192 back to sewing`);
        stats.rework++;

        const sewingStations = nonQcStations.filter((s) => s.type === 'sewing');
        for (const st of sewingStations) {
          if (signal.aborted) return;
          const d = randDelay(STEP_DELAY);
          console.log(`[${ts()}]   \u25F7 ${st.station_id} (rework) ... ${fmtDuration(d)}`);
          await abortableSleep(d, signal);
          if (signal.aborted) return;
          await postEvent(st, bundle.rfidUid, 'COMPLETE');
          stats.events++;
          console.log(`[${ts()}]   \u2713 ${st.station_id} COMPLETE (rework)`);
        }

        // Final QC pass after rework
        if (signal.aborted) return;
        const d = randDelay(STEP_DELAY);
        console.log(`[${ts()}]   \u25F7 ${qcStation.station_id} (qc re-check) ... ${fmtDuration(d)}`);
        await abortableSleep(d, signal);
        if (signal.aborted) return;
        await postEvent(qcStation, bundle.rfidUid, 'QC_PASS');
        stats.events++;
        console.log(`[${ts()}]   \u2713 ${qcStation.station_id} QC_PASS (after rework)`);
      }
    }
  } else {
    // No QC station — just count as pass
    stats.pass++;
  }

  const elapsed = fmtDuration(Date.now() - startTime);
  const outcome = scenario === 'rework' ? 'qc_pass (rework)' : scenario === 'pass' ? 'qc_pass' : 'qc_fail';
  console.log(`[${ts()}] \u2705 Bundle #${bundleNum} done \u2502 ${outcome} \u2502 ${elapsed}`);
}

// ── Heartbeats ──────────────────────────────────────────────────────────────

function startHeartbeats(stations: MappedStation[], signal: AbortSignal): void {
  const run = async () => {
    while (!signal.aborted) {
      for (const st of stations) {
        try {
          await jfetch('/api/v1/station/heartbeat', {
            method: 'POST',
            headers: stationHeaders(st.token),
            json: { ts: new Date().toISOString() },
          });
        } catch {
          // ignore heartbeat errors
        }
      }
      await abortableSleep(HEARTBEAT_INTERVAL, signal);
    }
  };
  run();
}

// ── Abort-aware sleep ───────────────────────────────────────────────────────

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    const onAbort = () => { clearTimeout(timer); resolve(); };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const ac = new AbortController();
  const { signal } = ac;

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n\nShutting down...');
    ac.abort();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`Connecting to ${API}...`);
  console.log();

  // 1. Discover mapped stations
  const stations = await discoverStations();
  if (stations.length < 2) {
    console.error(`Only ${stations.length} mapped station(s) found for ${FACTORY_CODE}.`);
    console.error('Need at least 2 mapped stations (with station_id, line_id, and type).');
    console.error('Map stations via the Admin UI or PATCH /api/v1/admin/stations/:id/map');
    process.exit(1);
  }

  // 2. Build pipeline
  const pipeline = buildPipeline(stations);

  // 3. Re-claim to get fresh tokens
  await claimTokens(stations);

  // 4. Determine line name from first station
  const lineName = pipeline[0].line_name;

  // 5. Print banner
  printBanner(pipeline, lineName);

  // 6. Start heartbeats
  startHeartbeats(pipeline, signal);

  // 7. Run bundles continuously
  const stats: Stats = { bundles: 0, pass: 0, fail: 0, rework: 0, events: 0 };
  let bundleNum = 0;

  while (!signal.aborted) {
    bundleNum++;

    try {
      await runBundle(bundleNum, pipeline, stats, signal);
    } catch (err: any) {
      if (signal.aborted) break;
      console.error(`[${ts()}] Error on bundle #${bundleNum}: ${err.message}`);
    }

    if (signal.aborted) break;

    // Print periodic stats every 5 bundles
    if (stats.bundles % 5 === 0) {
      printStats(stats);
      console.log();
    }

    // Gap between bundles
    const gap = randDelay(BUNDLE_GAP);
    await abortableSleep(gap, signal);
  }

  // Final stats
  printStats(stats);
  console.log('\nDemo simulation ended.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
