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

## Tests

```bash
npm test
```
