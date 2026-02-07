# RMG RFID ETS/PTS (Bundle Tracking) — Node Spec

Scope (per Arif):
- **Bundle-level** tracking (bundle size ~10 pcs)
- Stations: **each sewing machine table**, plus **cutting**, **finishing**, **QC per line**
- Station scan semantics: **one scan = COMPLETE**
- Connectivity: **Wi‑Fi primary**, **LoRaWAN fallback**
- Station identity: **MAC burned-in**, also **configurable in UI**

---

## 1) Concepts & IDs

### Entities
- **Factory**: a customer site
- **Line**: sewing line (L1..L10)
- **Station**: a physical reader at a workstation
- **Bundle**: unit of WIP; RFID-tagged
- **Event**: append-only record of a scan or QC result

### Identifiers
- `mac`: station MAC address (burned in)
- `station_id`: human-friendly station id (configured in UI), e.g. `L3-SW-12`, `L1-CUT-01`, `L2-QC-01`
- `rfid_uid`: tag EPC/UID string
- `bundle_id`: internal id (generated at bundle creation; linked to RFID)
- `event_id`: ULID/UUID (device-generated) for idempotency

---

## 2) Event model (one scan = COMPLETE)

### Event types
- `COMPLETE` (cutting / sewing / finishing stations)
- `QC_PASS`
- `QC_FAIL`
- Optional (later): `REWORK_ASSIGNED`, `REWORK_COMPLETE`, `HOLD`, `UNHOLD`

### Required event fields
- `event_id`, `ts`, `factory_id`
- station: `mac` + resolved `station_id` + `line_id` + `type`
- bundle: `rfid_uid` (server resolves to `bundle_id`)
- `event_type`

### QC fail payload
- `defects`: array of `{ code, qty?, severity?, note? }`
- optional: `photo_urls[]`

---

## 3) Device ↔ Server (Wi‑Fi) API

Base: `/api/v1`

### Auth
Use **per-station tokens**.
- Station claims once, receives `station_token`.
- All event posts use: `Authorization: Bearer <station_token>`

### 3.1 Station claim/provision

#### POST `/stations/claim`
Registers/claims a device by MAC and binds it to a factory.

Request:
```json
{
  "factory_code": "SOUTHERNIOT-DEMO",
  "mac": "A4:C1:38:12:34:56",
  "fw": "1.0.0",
  "capabilities": {"rfid": true, "wifi": true, "lorawan": true}
}
```

Response:
```json
{
  "station": {
    "id": "st_...",
    "mac": "A4:C1:38:12:34:56",
    "station_id": null,
    "line_id": null,
    "type": null
  },
  "token": "sttok_...",
  "config": {
    "eventMode": "complete",
    "clockSkewMsMax": 300000
  }
}
```

Notes:
- Initially `station_id/line_id/type` may be null until an admin maps it in UI.

### 3.2 Post an event

#### POST `/events`
Request:
```json
{
  "event_id": "01J1...ULID",
  "ts": "2026-02-05T11:04:00Z",
  "bundle": {"rfid_uid": "E2000017221101441890ABCD"},
  "event_type": "COMPLETE",
  "meta": {"rssi": -55}
}
```

Response (ok):
```json
{ "ok": true }
```

Response (needs mapping):
```json
{ "ok": false, "error": "station_unmapped" }
```

Response (unknown tag):
```json
{ "ok": false, "error": "unknown_bundle" }
```

Idempotency:
- Server must de-dup by `(station_id, event_id)`.

### 3.3 Bundle creation (cutting office/app)

#### POST `/bundles`
Used by cutting supervisor app / admin UI.

Request:
```json
{
  "order_id": "ORD-2026-0007",
  "style": "STYLE-XYZ",
  "color": "NAVY",
  "size": "L",
  "qty": 10,
  "line_route": ["CUT", "SW", "FIN", "QC"],
  "rfid_uid": "E2000017221101441890ABCD"
}
```

Response:
```json
{ "bundle_id": "bdl_...", "rfid_uid": "..." }
```

---

## 4) LoRaWAN fallback

Goal: keep minimal “proof of progress” when Wi‑Fi is down.

### Payload design (compact)
Send:
- `mac` (or short hash)
- `event_type`
- `rfid_uid_short` (e.g., last 6–8 hex chars)
- `ts_epoch`

Gateway/server resolves `mac → station`, `rfid_uid_short → bundle` (requires registry + collision handling).

Recommendation:
- Use LoRaWAN only for **COMPLETE** and **QC_PASS/QC_FAIL**, not for verbose metadata.
- Device buffers full events locally and backfills via Wi‑Fi when restored.

---

## 5) Device requirements

- Local queue (ring buffer) for events until ACK
- Retry with exponential backoff
- Clock sync (NTP over Wi‑Fi); allow ±5 min skew
- LED/buzzer feedback:
  - green: accepted
  - red: station_unmapped / unknown_bundle

---

## 6) Database schema (Postgres)

### factories
- `id` (pk), `name`, `code` (unique)

### lines
- `id` (pk), `factory_id` (fk), `name`

### stations
- `id` (pk)
- `factory_id` (fk)
- `mac` (unique)
- `station_id` (unique within factory)
- `line_id` (fk, nullable)
- `type` (enum: cutting|sewing|finishing|qc)
- `token_hash`, `created_at`, `updated_at`

### bundles
- `id` (pk)
- `factory_id` (fk)
- `order_id`, `style`, `color`, `size`
- `qty` int default 10
- `rfid_uid` (unique)
- `status` (enum: created|in_progress|qc_pass|qc_fail|rework|packed)
- `current_station_id` (fk, nullable)
- `current_line_id` (fk, nullable)
- `updated_at`

### events (append-only)
- `id` (pk)
- `factory_id` (fk)
- `event_id` (text)  
- `bundle_id` (fk)
- `station_id` (fk)
- `line_id` (fk, nullable)
- `event_type` (complete|qc_pass|qc_fail|...)
- `ts` timestamptz
- `meta` jsonb

Indexing:
- unique `(station_id, event_id)`
- index `(bundle_id, ts desc)`
- index `(station_id, ts desc)`

### qc_defects (optional table if not json)
- `id`, `event_id` (fk events), `code`, `qty`, `note`

---

## 7) State update rules (server)

On event insert:
1) Resolve `station` from token → station row
2) Resolve `bundle_id` from `rfid_uid`
3) Insert event (idempotent)
4) Update bundle:
   - `current_station_id = station.id`
   - `current_line_id = station.line_id`
   - `status`:
     - `COMPLETE`: keep `in_progress`
     - `QC_PASS`: `qc_pass`
     - `QC_FAIL`: `qc_fail` (+ optionally `rework`)

---

## 8) Admin / UI screens (MVP)

### Admin
- Factories, lines
- **Station mapping**: list by MAC → assign station_id, line, type
- Bundle creation + RFID assignment

### Production (Supervisor)
- Live WIP Kanban (Line → Station columns)
- Aging/bottleneck view (bundles stuck > X min)
- Bundle trace (timeline)

### QC
- QC scan page (Pass / Fail + defect codes)
- Defect Pareto by style/line/date

---

## 9) Acceptance tests

- Unknown station (no mapping) → `station_unmapped`
- Unknown RFID → `unknown_bundle`
- Duplicate event_id from same station → no double counting
- Wi‑Fi down → queue events → backfill once online

---

## 10) Next decisions (from initial draft)

1) Do we require operator identity? (RFID card/PIN)
2) How many sewing stations per line (rough) for device count & mapping UI scaling?
3) QC defect code list source (buyer standard / internal taxonomy)

---

# Architecture / Risks / Decisions / Rollout (System Architect Deliverables)

## A) Refined architecture (components + data flow)

### Components
- **RFID Reader Node (per station)**
  - UHF RFID module + MCU (ESP32-class) with Wi‑Fi + optional LoRaWAN radio
  - Local persistent **event queue** (flash) + retry/ACK logic
  - Device UI: buzzer/LED (accepted / error)
- **Wi‑Fi Network**
  - Factory AP(s); device uses NTP when connected
- **LoRaWAN Network (fallback)**
  - End-device → LoRaWAN gateway/NNS (e.g., ChirpStack / TTN) → HTTP integration
- **Backend API (RMG ETS/PTS Server)**
  - Auth: per-station token; rate limiting per token
  - Services (can be one deploy initially):
    - Station provisioning + mapping resolver
    - Event ingestion (idempotent)
    - Bundle registry
    - Query APIs for UI
- **Database (Postgres)**
  - Source of truth for stations/bundles/events
- **Admin / Production / QC Web UI**
  - Station mapping (MAC → station_id/line/type)
  - Bundle creation + RFID assignment
  - Line WIP views + traceability

### Data flows
- **Provisioning / mapping**
  1) Station boots → `POST /stations/claim` with `factory_code + mac`
  2) Server returns `station_token` + base config
  3) Admin UI maps station: `mac → station_id + line_id + type`
- **Normal scan (Wi‑Fi)**
  1) Tag read → device builds event `{event_id, ts, rfid_uid, event_type}`
  2) Device `POST /events` (Bearer token)
  3) Server resolves token→station, rfid_uid→bundle, inserts event (dedup), updates bundle current_station/status
  4) Server returns `{ok:true}` → device green feedback and drops from queue
- **Offline / Wi‑Fi down**
  - Device enqueues events locally; retries with backoff
  - If LoRaWAN available: device sends **compact proof** uplink for the same scan
  - When Wi‑Fi restores: device backfills full queued events via `/events`
- **LoRaWAN uplink handling**
  1) NNS forwards uplink to backend webhook
  2) Backend resolves `mac/hash + rfid_uid_short` to station/bundle
  3) Backend writes an event with `meta.source="lorawan"` (mark as provisional if needed)
  4) On later Wi‑Fi backfill, server de-dups by `event_id` (recommended) or reconciles by nearest timestamp + same station + same tag

### Scaling posture (10–50x)
- Keep ingestion stateless; scale API horizontally behind reverse proxy
- Use Postgres with proper indexes + partition events by time later if needed
- Add async worker only when necessary (e.g., metrics aggregation, alerts)

---

## B) Top risks (10) + mitigations

1) **Station unmapped blocks production**
   - Mitigation: “grace mode” in UI (show unmapped devices instantly); bulk mapping; print MAC QR on device.
2) **RFID tag collisions / duplicate tag assignment**
   - Mitigation: enforce unique `rfid_uid`; bundle creation screen warns on reuse; audit log.
3) **LoRaWAN short UID collisions (rfid_uid_short)**
   - Mitigation: use longer short (8–10 hex) + per-factory namespace; collision table; if ambiguous, store as “unresolved” and reconcile on Wi‑Fi backfill.
4) **Event double counting (retries, unstable Wi‑Fi)**
   - Mitigation: strict idempotency unique `(station_id, event_id)`; device generates ULID; ACK required.
5) **Clock drift affects ordering/aging KPIs**
   - Mitigation: NTP on connect; allow skew window; server can store `received_at` and use it for SLA dashboards when device clock invalid.
6) **RFID misreads / multi-tag reads at station**
   - Mitigation: reader config (anti-collision, RSSI threshold); debounce window (e.g., ignore same UID for 2–5s); physical tag placement guidance.
7) **Token leakage / rogue station posting events**
   - Mitigation: rotate station tokens; bind token to MAC at claim; server checks claimed MAC; rate limit + anomaly detection.
8) **Network outages longer than device queue capacity**
   - Mitigation: size queue for worst-case (e.g., 10k events); backpressure (red LED when near-full); optional SD.
9) **Station identity ambiguity (MAC change, cloned modules)**
   - Mitigation: treat MAC as primary; also store device serial + provisioning secret; alert on duplicate MAC claims.
10) **UI bottlenecks at scale (mapping 300–1000 stations)**
   - Mitigation: pagination + filters by line/type; bulk import CSV mapping; QR-based assignment workflow.

---

## C) Decisions needed from Arif (max 7)

1) **LoRaWAN mode:** Is LoRaWAN used only as “proof of progress” (best-effort) or must it be fully authoritative when Wi‑Fi is down?
2) **Event reconciliation rule:** When LoRaWAN and later Wi‑Fi backfill both arrive, do we require same `event_id` (preferred) or allow heuristic merge?
3) **Station types list:** Finalize station `type` enum and naming convention (e.g., CUT, SW, FIN, QC) and whether sewing is per-table always.
4) **Bundle lifecycle:** After `QC_FAIL`, do we stop movement until rework events exist, or keep simple (fail status only) for MVP?
5) **Operator identity:** Confirm “no operator id for MVP” vs require card/PIN now.
6) **Defect codes:** Provide initial defect taxonomy (even small) and whether per-factory customization is allowed.
7) **Device queue sizing target:** Expected worst-case offline duration (hours/days) to size flash queue and backoff strategy.

---

## D) Phased rollout plan (Pilot → Scale)

### Phase 0 — Lab / pre-pilot (1–2 weeks)
- One backend instance + Postgres; basic Admin UI
- Device firmware: claim, Wi‑Fi events, local queue, LED/buzzer
- Acceptance tests from spec automated (idempotency, unknown tag/station)

### Phase 1 — Pilot line (2–4 weeks)
- Deploy on **1 line**: cutting + 5–15 sewing stations + finishing + 1 QC
- Station mapping workflow hardened (QR/MAC list)
- KPIs: scan success rate, duplicate rate, offline backlog, station_unmapped occurrences

### Phase 2 — Multi-line scale (4–8 weeks)
- Expand to 5–10 lines; introduce CSV bulk station mapping
- Performance: add caching for station lookup; tune DB indexes
- Add basic monitoring: API latency, event ingest rate, device last_seen

### Phase 3 — Factory-wide + reliability (ongoing)
- Enable LoRaWAN fallback in production (if approved)
- Add reconciliation dashboards (unresolved LoRa events, missing backfills)
- Hardening: token rotation, device firmware OTA process, DB backups/retention policy
