# RMG RFID ETS — CEO Brief (Pilot-Ready Overview)

## 1) What we’re building
**RMG RFID ETS** is a bundle-level RFID tracking system for garment production lines.

Goal: **real-time, reliable visibility** of bundle movement (e.g., sewing completion) with a low-friction operator workflow.

## 2) Why it matters (business value)
- **Reduce WIP ambiguity:** Know where each bundle is, and its current state.
- **Lower loss/misplacement:** RFID ties a physical bundle to a digital record.
- **Faster issue resolution:** Clear error states (unmapped station, unknown bundle/tag) reduce downtime.
- **Auditability:** Time-stamped event trail supports compliance and reporting.

## 3) Pilot scope (MVP)
**Pilot line:** one factory code, one line, one station type (e.g., sewing), basic COMPLETE event.

MVP must support:
1) **Station provisioning + mapping** (MAC → station_id/line/type)
2) **Bundle creation + RFID assignment** (avoid duplicates)
3) **Event ingest** from stations with immediate operator feedback

## 4) System components
### A) RFID Station Device (ESP32)
- Platform: **ESP32-WROOM**, firmware via **PlatformIO (ESP-IDF)**
- Peripherals:
  - RFID reader: **MFRC522 (SPI/HSPI)** → reads UID
  - Display: **ILI9341 (SPI/VSPI)** status UI
  - Touch: **FT6336 (I2C)**
  - Feedback: RGB LED + buzzer
- Responsibilities:
  - Connect Wi‑Fi, keep time (SNTP)
  - Claim station, maintain auth token
  - Read RFID UID and POST events
  - Provide clear accept/reject feedback

### B) Backend API (Node/Express + Postgres)
Repo: `projects/rmg-rfid-ets`
- API base: `/api/v1`
- Key endpoints:
  - `POST /stations/claim` → issues station token (per MAC)
  - `POST /events` → station-auth Bearer token; idempotent ingest
  - `POST /bundles` → create bundle + assign RFID
- Reliability:
  - **Idempotency**: dedupe `(station_id, event_id)`
  - Explicit error contract for common failures:
    - `station_unmapped` (409)
    - `unknown_bundle` (404)

### C) Admin UI / Ops UI
Purpose: map stations, monitor stations, manage bundles.

## 5) How data flows (high level)
1) Station boots and calls **claim** using `factory_code + MAC`.
2) Admin maps the station to a human-readable **station_id** (e.g., `L1-SW-01`), line, and type.
3) Bundle is created in the backend and assigned an RFID UID.
4) Station reads RFID UID and submits an **event** (e.g., `COMPLETE`).
5) Backend validates:
   - station is mapped
   - RFID belongs to a known bundle
   - event is not a duplicate
6) Backend writes event + updates bundle state; station shows OK/fail feedback.

## 6) Security model (MVP)
- Station uses **Bearer token** obtained from `/stations/claim`.
- Station token limits access to station-scoped actions (event ingest).
- Admin endpoints can be protected separately (role-based auth later).

## 7) Operational reliability (what makes pilot work)
- Fast provisioning/mapping (no manual DB edits)
- Clear on-device feedback:
  - unmapped station → distinct LED/buzzer
  - unknown RFID/bundle → distinct LED/buzzer
  - success → distinct LED/buzzer + UI confirmation
- Event ingest is **retry-safe** via idempotency

## 8) Pilot success metrics
- **Scan success rate** ≥ 99% for valid RFID tags
- **Median response time** < 300ms on LAN
- **Time to provision + map a station** < 2 minutes
- **Zero duplicate state transitions** (dedupe works)

## 9) Roadmap after pilot
- Multi-event workflows (QC_PASS/QC_FAIL, rework)
- Operator identity (badge/PIN) and accountability
- Offline buffering on device for Wi‑Fi drops
- Analytics dashboards (line throughput, bottlenecks, exceptions)
- LoRaWAN fallback (if required)

---
**One-line pitch:** “RFID stations capture production events at the line, the backend validates and records them reliably, and the admin UI enables fast provisioning and visibility—so we always know the live state of each bundle.”
