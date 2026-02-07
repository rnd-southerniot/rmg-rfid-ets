import 'dotenv/config';

const API = process.env.API_BASE ?? `http://127.0.0.1:${process.env.PORT ?? '3003'}`;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const FACTORY_CODE = process.env.SEED_FACTORY_CODE ?? 'SOUTHERNIOT-DEMO';

if (!ADMIN_TOKEN) {
  throw new Error('ADMIN_TOKEN is required in .env for simulation');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function randHex(n: number) {
  const chars = '0123456789ABCDEF';
  let s = '';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function randMac() {
  const bytes = Array.from({ length: 6 }, () => randHex(2));
  return bytes.join(':');
}

async function jfetch(path: string, opts: RequestInit & { json?: any } = {}) {
  const headers: Record<string, string> = {
    ...(opts.headers as any)
  };

  if (opts.json !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const res = await fetch(API + path, {
    ...opts,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${path}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }

  return data;
}

async function main() {
  console.log('API:', API);
  console.log('Factory:', FACTORY_CODE);

  // Ensure lines exist (seed already does this, but harmless to call admin read)
  const lines = await jfetch(`/api/v1/admin/lines?factory_code=${encodeURIComponent(FACTORY_CODE)}`, {
    headers: { 'x-admin-token': ADMIN_TOKEN }
  });
  console.log('Lines:', lines.lines.map((l: any) => l.name).join(','));

  // Claim 2 stations
  const sewingMac = randMac();
  const qcMac = randMac();

  const sewingClaim = await jfetch('/api/v1/stations/claim', {
    method: 'POST',
    json: { factory_code: FACTORY_CODE, mac: sewingMac, fw: 'sim', capabilities: { sim: true } }
  });
  const qcClaim = await jfetch('/api/v1/stations/claim', {
    method: 'POST',
    json: { factory_code: FACTORY_CODE, mac: qcMac, fw: 'sim', capabilities: { sim: true } }
  });

  console.log('Claimed sewing station:', sewingClaim.station.id, sewingMac);
  console.log('Claimed qc station:', qcClaim.station.id, qcMac);

  // Map them
  const map1 = await jfetch(`/api/v1/admin/stations/${sewingClaim.station.id}/map`, {
    method: 'PATCH',
    headers: { 'x-admin-token': ADMIN_TOKEN },
    json: { station_id: `SIM-SW-${randHex(2)}`, line_name: 'L1', type: 'sewing' }
  });
  const map2 = await jfetch(`/api/v1/admin/stations/${qcClaim.station.id}/map`, {
    method: 'PATCH',
    headers: { 'x-admin-token': ADMIN_TOKEN },
    json: { station_id: `SIM-QC-${randHex(2)}`, line_name: 'L1', type: 'qc' }
  });

  console.log('Mapped:', map1.station.station_id, 'and', map2.station.station_id);

  // Create a new bundle with random RFID
  const rfid = `E200001722110144${randHex(8)}`;
  const bundle = await jfetch('/api/v1/bundles', {
    method: 'POST',
    json: {
      factory_code: FACTORY_CODE,
      order_id: `SIM-ORD-${randHex(4)}`,
      style: 'SIMSTYLE',
      color: 'NAVY',
      size: 'L',
      qty: 10,
      line_route: ['CUT', 'SW', 'FIN', 'QC'],
      rfid_uid: rfid
    }
  });
  console.log('Created bundle:', bundle.bundle_id, 'rfid:', rfid);

  const now = new Date();

  // COMPLETE from sewing station
  const e1 = await jfetch('/api/v1/events', {
    method: 'POST',
    headers: { authorization: `Bearer ${sewingClaim.token}` },
    json: {
      event_id: `SIM-${Date.now()}-C1`,
      ts: new Date(now.getTime() + 1000).toISOString(),
      bundle: { rfid_uid: rfid },
      event_type: 'COMPLETE',
      meta: { sim: true }
    }
  });
  console.log('Posted COMPLETE:', e1);

  await sleep(400);

  // QC_FAIL from qc station
  const e2 = await jfetch('/api/v1/events', {
    method: 'POST',
    headers: { authorization: `Bearer ${qcClaim.token}` },
    json: {
      event_id: `SIM-${Date.now()}-QF`,
      ts: new Date(now.getTime() + 2000).toISOString(),
      bundle: { rfid_uid: rfid },
      event_type: 'QC_FAIL',
      defects: [{ code: 'SIM_DEFECT', qty: 1, severity: 'minor' }]
    }
  });
  console.log('Posted QC_FAIL:', e2);

  const final = await jfetch(`/api/v1/bundles/by-rfid/${encodeURIComponent(rfid)}`);
  console.log('Final bundle status:', final.bundle.status);
  console.log('Done. Open UI live feed to watch events stream.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
