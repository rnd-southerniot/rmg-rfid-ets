# RMG RFID ETS/PTS — Next Steps Plan (2026-02-06)

This is a practical, build-next plan for getting the factory/RFID MVP into a pilot-ready state.

## Current state (what already exists)
- Postgres schema + migration: `db/migrations/001_init.sql`
- Node/Express API skeleton:
  - `POST /api/v1/stations/claim` (creates/updates station by MAC, issues token)
  - `POST /api/v1/bundles` (requires `factory_code`, creates bundle + assigns RFID)
  - `POST /api/v1/events` (station-token auth; rejects unmapped station; idempotent by `(station_id,event_id)`; updates bundle state)
- Minimal acceptance tests in `test/api.test.ts`

## The 3 MVP goals (pilot line)
1) **Provision + map stations** fast (MAC list → station_id + line + type).
2) **Create bundles + assign RFID** reliably (no duplicates; traceable).
3) **Ingest scans** reliably with great operator feedback (accepted vs unmapped vs unknown tag).

## Decisions needed from you (to lock scope)
Answer these and I’ll reflect them into `spec/SPEC.md`:
1) MVP operator identity: **none** (keep simple) OR **badge/PIN** now?
2) Sewing stations per line estimate (for mapping UI scale): ~__ ?
3) QC Fail flow: just mark `qc_fail` OR introduce `rework_*` events in MVP?
4) LoRaWAN fallback in pilot: **off** (Wi‑Fi only) OR **best-effort proof** on pilot?

## Phase 1 — Make backend “pilot usable” (1–2 days)
### A) Add Admin mapping endpoints (required)
Right now stations can claim, but there is no way to map them (station_id/line/type) except manual DB.

Add endpoints (admin token / basic auth for now):
- `GET /api/v1/admin/factories` + `POST /api/v1/admin/factories`
- `POST /api/v1/admin/lines` (create line under factory)
- `GET /api/v1/admin/stations?factory_code=...` (list stations)
- `PATCH /api/v1/admin/stations/:id/map`
  - body: `{ station_id, line_name or line_id, type }`
  - enforce unique `(factory_id, station_id)`

### B) Add “seed” and “dev” UX
- Add `npm run seed` to create demo factory + lines.
- Add `docker-compose.yml` for local Postgres.

### C) Add “read APIs” for UI/device debugging
- `GET /api/v1/stations/me` (who am I, mapping status)
- `GET /api/v1/bundles/:id` + `GET /api/v1/bundles?factory_code=&status=&since=`
- `GET /api/v1/bundles/:id/events` (timeline)

### D) Tighten validation + error contract
- Standardize errors: `invalid_request | unauthorized | station_unmapped | unknown_bundle | unknown_factory | rfid_already_assigned`.
- Enforce `event_id` format (ULID/UUID-ish) if you want.

### E) Expand tests
Add acceptance tests for:
- claim station creates factory if missing
- mapping endpoint works + rejects duplicates
- bundle create: unknown_factory fails
- event ingest: QC_PASS/QC_FAIL updates bundle status

## Phase 2 — Pilot “station tool” (fast UI) (1–2 days)
To run a pilot you need a quick operator/admin interface.

Option 1 (fastest): **Single-page admin web** (Next.js or Vite) for:
- Station list (by MAC) → map station
- Bundle create (assign RFID)
- Bundle lookup by RFID

Option 2: use **Node-RED dashboard** temporarily.

## Phase 3 — Device integration loop (parallel)
- First bring up 1 station firmware (ESP32) that:
  - calls `/stations/claim`
  - posts `/events` with local queue + retries
  - LED/buzzer feedback based on HTTP response
- Pilot acceptance: 99% scan success on good Wi‑Fi; clear error feedback.

## Suggested “today” sequence (lowest risk)
1) Decide factory_code naming convention for pilot (e.g., `RMG-DEMO-001`).
2) Add admin mapping endpoints + seed.
3) Write a 1-page runbook: how to claim, map, create bundle, scan.
4) Try end-to-end flow with Postman/curl.

---
If you want, I can implement Phase 1 (admin endpoints + compose + seeds + tests) directly in this repo next.
