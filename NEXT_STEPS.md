# RMG RFID ETS — Next Steps Plan (updated 2026-02-07)

This is the working plan to take the ETS MVP from “works locally” to “pilot-ready in a factory line”.

## Current state (what exists now)
Backend repo: `rnd-southerniot/rmg-rfid-ets`

- Backend: Node/Express + Postgres; API base `/api/v1`
- Core station flow:
  - `POST /stations/claim` → station token
  - `POST /events` (Bearer station token) → idempotent ingest
  - `POST /bundles` → create + assign RFID
- Admin/Ops endpoints added for mapping + debugging:
  - `src/routes/admin.ts`
  - `src/routes/stationStatus.ts`
  - `src/routes/adminEvents.ts`
- Local ops: docker compose, seeds, simulation scripts
- Web demo dashboard at `/demo` — browser-based simulation control + live pipeline visualization (SSE)
- Simulation engine (`src/simulation.ts`) runs in-process, writes directly to DB pool
- CEO docs + diagrams exported to PNG/SVG/PDF under `docs/`

> Note: Firmware lives in `projects/rmg-rfid-station-fw` (ESP32 PlatformIO/ESP-IDF).

## The 3 pilot goals (still the same)
1) **Provision + map stations** quickly (MAC → station_id + line + type)
2) **Create bundles + assign RFID** reliably (no duplicates, traceable)
3) **Ingest scans** reliably with great operator feedback (OK vs unmapped vs unknown tag)

## Decisions to finalize for pilot (CEO-ready scope lock)
1) Operator identity in MVP: **none** OR **badge/PIN**
2) Station mapping scale: sewing stations per line ~ __ ?
3) QC flow: just `qc_fail` OR add rework events
4) Connectivity in pilot: Wi‑Fi only OR also LoRaWAN fallback

## Phase A — Finish “Pilot Runbook” (0.5 day)
Deliverable: a document that a factory tech can follow.

- [ ] Prereqs: backend URL, factory_code, Wi‑Fi SSID/pass
- [ ] Start backend + DB
- [ ] Station claim checklist
- [ ] Station mapping checklist (what station_id means; naming convention)
- [ ] Bundle create + RFID assign steps
- [ ] Scan and verify event timeline
- [ ] Common errors + fixes (`station_unmapped`, `unknown_bundle`, auth)

## Phase B — Firmware end-to-end validation (1 day)
Goal: 1 station does claim → heartbeat → scan → post event → feedback.

- [ ] Confirm MFRC522 UID read with real cards (UID as **hex**) matches backend expectation (`bundle.rfid_uid`)
- [ ] Verify `POST /api/v1/events` success path and failure feedback patterns
- [ ] Add/confirm retry strategy and de-dup on device
- [ ] Confirm station mapping status is visible (LCD)

## Phase C — Admin UI / operator tooling (1–2 days)
Pick the fastest UI that supports pilot operations:

- Station list (last_seen, mapped/unmapped)
- Map station (station_id/line/type)
- Create bundle + assign RFID
- Lookup bundle by RFID (show last events)

## Phase D — Reliability + observability hardening (1–2 days)
- [ ] Add server-side metrics/logging: event rates, failure counts
- [ ] Add station heartbeat tracking (`last_seen` already planned)
- [ ] Rate limiting / auth tightening for admin endpoints
- [ ] Database indexes for RFID lookup and event timelines

## Phase E — Pilot acceptance checklist
- [ ] Provision + map a station in < 2 minutes
- [ ] Scan success rate ≥ 99% for valid tags on LAN Wi‑Fi
- [ ] Clear feedback for top 3 errors
- [ ] Event timeline shows correct ordering and idempotency
