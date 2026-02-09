# rmg-rfid-ets (backend)

MVP Node/Express + Postgres backend for bundle-level RFID tracking.

## Quick start

```bash
npm i
cp .env.example .env

# start Postgres (optional, for local dev)
docker compose up -d

npm run migrate
npm run seed
npm run dev
```

Health:
- `GET /health`

API base:
- `/api/v1`

## Endpoints (MVP)

### Station claim
`POST /api/v1/stations/claim`

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
  "station": {"id":"st_...","mac":"A4:C1:...","station_id":null,"line_id":null,"type":null},
  "token": "sttok_...",
  "config": {"eventMode":"complete","clockSkewMsMax":300000}
}
```

### Bundle create
`POST /api/v1/bundles`

Note: for multi-factory setups include `factory_code`.

### Event ingest
`POST /api/v1/events` (requires `Authorization: Bearer <station_token>`)

Idempotency: de-duped by `(station_id, event_id)`.

Errors:
- `409 {ok:false,error:"station_unmapped"}`
- `404 {ok:false,error:"unknown_bundle"}`

## Docs

- `docs/CEO_BRIEF.md` — CEO-friendly overview
- `docs/ARCHITECTURE.md` — system architecture + diagrams
- `docs/README_PRESENTATION.md` — quick presentation pack

## Live Demo Simulation

Continuous real-time simulation against a running backend — bundles flow through discovered stations with QC pass/fail/rework scenarios. Designed for CEO demos and Admin UI SSE feed testing.

### Prerequisites

```bash
# 1. Start Postgres
docker compose up -d

# 2. Set up env (if not already)
cp .env.example .env
# Edit .env: set ADMIN_TOKEN, DATABASE_URL with port 5434

# 3. Migrate + seed
npm run migrate
npm run seed

# 4. Start backend
npm run dev

# 5. Ensure at least 2 mapped stations exist for SOUTHERNIOT-DEMO factory
#    (claim via POST /api/v1/stations/claim, map via PATCH /api/v1/admin/stations/:id/map)
```

### Run

```bash
npm run simulate:demo                    # realistic pacing (30-60s per step)
SIM_SPEED=fast npm run simulate:demo     # fast mode (5-10s per step)
```

The script auto-discovers mapped stations, re-claims for fresh tokens, builds a pipeline (e.g. `L1-SW-01 → L1-SW-02 → L1-FIN-01 → L1-QC-01`), and runs bundles through it continuously. Ctrl+C for clean shutdown with stats.

## Tests

```bash
npm test
```
