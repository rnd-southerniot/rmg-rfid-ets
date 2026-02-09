# RMG RFID ETS — Project Summary

**Bundle-Level RFID Tracking for Garment Production Lines**

---

## The Problem

Garment factories lack real-time visibility into bundle movement across production lines. Bundles get lost, misplaced, or stalled — causing WIP ambiguity, rework delays, and manual tracking overhead. There's no reliable way to know where a bundle is at any given moment.

## The Solution

**RMG RFID ETS** places RFID stations at every workstation on the factory floor. Each station scans bundles as they pass through cutting, sewing, finishing, and QC. The backend validates, records, and streams every event in real-time.

> "RFID stations capture production events at the line, the backend validates and records them reliably, and the admin UI enables fast provisioning and visibility — so we always know the live state of each bundle."

---

## System Overview

```
  Factory Floor                    Backend                    Clients
 ┌─────────────┐              ┌──────────────┐          ┌──────────────┐
 │ ESP32 + RFID│  Wi-Fi/HTTP  │  Node/Express│  HTTPS   │   Admin UI   │
 │  Station 1  │─────────────→│   /api/v1    │←─────────│  (mapping,   │
 │  (cutting)  │              │              │          │  monitoring) │
 ├─────────────┤              │  Auth Layer  │          ├──────────────┤
 │  Station 2  │─────────────→│  (Bearer +   │←─────────│ Demo Dashboard│
 │  (sewing)   │              │   Admin)     │   SSE    │  (/demo)     │
 ├─────────────┤              │              │          │  Real-time   │
 │  Station 3  │─────────────→│  Simulation  │          │  pipeline    │
 │ (finishing) │              │  Engine      │          └──────────────┘
 ├─────────────┤              └──────┬───────┘
 │  Station 4  │─────────────→       │ SQL
 │    (QC)     │              ┌──────┴───────┐
 └─────────────┘              │  Postgres 16 │
                              │  5 tables    │
                              └──────────────┘
```

---

## Key Capabilities

### 1. Station Provisioning
- ESP32 stations self-register by MAC address
- Admin maps each station to a human-readable ID (e.g., `L1-SW-01`), line, and type
- Bearer tokens issued per station for secure event posting

### 2. Bundle Tracking
- Bundles created with unique RFID UID assignment
- Status tracked through lifecycle: `created → in_progress → qc_pass / qc_fail`
- Rework flow supported (QC fail → re-sew → QC pass)

### 3. Event Ingest
- Idempotent event recording (no duplicates, safe retries)
- Station type enforcement (QC stations: QC_PASS/QC_FAIL only; others: COMPLETE only)
- Real-time bundle status updates on every scan

### 4. Real-Time Monitoring
- SSE event stream for live dashboards
- Station heartbeat tracking (last_seen_at)
- Admin API for full factory/line/station/bundle CRUD

### 5. Live Demo Dashboard
- Browser-based at `/demo` — no install needed
- Start/stop simulation, toggle speed (fast 5-10s / realistic 30-60s)
- Pipeline visualization with animated station cards
- Live event feed + running stats (bundles, pass, fail, rework, events)

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| **Firmware** | ESP32-WROOM, PlatformIO/ESP-IDF, MFRC522 RFID reader, ILI9341 LCD, FT6336 touch |
| **Backend** | Node.js, Express, TypeScript, Zod validation |
| **Database** | PostgreSQL 16, plain SQL migrations (idempotent) |
| **Auth** | Station bearer tokens (SHA-256 hashed), admin static token |
| **Testing** | Vitest + pg-mem (in-memory Postgres), Supertest |
| **Deployment** | Docker, Fly.io (Singapore region), auto-stop/start machines |
| **Real-time** | Server-Sent Events (SSE) for live streaming |

---

## API Surface

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/v1/stations/claim` | None | Station provisioning by MAC |
| `POST /api/v1/events` | Station Bearer | Event ingest (idempotent) |
| `POST /api/v1/station/heartbeat` | Station Bearer | Station keepalive |
| `GET /api/v1/station/me` | Station Bearer | Station self-introspection |
| `POST /api/v1/bundles` | None | Create bundle + assign RFID |
| `POST /api/v1/bundles/bulk` | None | Bulk bundle creation |
| `GET /api/v1/bundles/by-rfid/:uid` | None | Lookup bundle by RFID |
| `GET/POST /api/v1/admin/*` | Admin Token | Factory, line, station CRUD |
| `GET /api/v1/admin/events/recent` | Admin Token | Recent events query |
| `GET /api/v1/admin/events/stream` | Admin Token | SSE live event stream |
| `POST /api/v1/simulation/start` | Admin Token | Start demo simulation |
| `POST /api/v1/simulation/stop` | Admin Token | Stop simulation |
| `GET /api/v1/simulation/status` | Admin Token | Simulation state + stats |
| `GET /api/v1/simulation/log` | Admin Token | SSE simulation log stream |
| `GET /demo` | None | Web demo dashboard |

---

## Database Schema

Five tables, all with text primary keys (`prefix_base36time_hex` format):

- **factories** — factory code + name
- **lines** — production lines per factory
- **stations** — RFID stations with MAC, mapping (station_id, line, type), token hash, heartbeat
- **bundles** — production bundles with RFID UID, order, style, status, current position
- **events** — append-only scan log with idempotency constraint `UNIQUE(station_id, event_id)`

### Bundle States
```
created → in_progress → qc_pass (done)
                      → qc_fail → in_progress (rework) → qc_pass
```

### Event Types
```
COMPLETE    — bundle scanned at cutting/sewing/finishing station
QC_PASS     — bundle passed quality check
QC_FAIL     — bundle failed quality check (with defect codes)
```

---

## Quality & Reliability

| Metric | Value |
|--------|-------|
| Source files | 18 TypeScript modules |
| Test files | 8 test suites |
| Test cases | 32 passing |
| Source lines | ~1,600 |
| Test lines | ~830 |
| Test backend | pg-mem (no real DB needed) |
| Idempotency | Event dedup via unique constraint |
| Auth | Two-layer (station bearer + admin token) |

---

## Running the Demo

### Local
```bash
docker compose up -d          # Start Postgres
npm run migrate && npm run seed  # Set up schema + demo data
npm run dev                   # Start backend on :3003
# Claim + map stations (or use simulation which auto-discovers)
open http://localhost:3003/demo  # Open dashboard
```

### Cloud (Fly.io)
```bash
fly launch --no-deploy
fly postgres create --name rmg-rfid-ets-db
fly postgres attach rmg-rfid-ets-db
fly secrets set ADMIN_TOKEN=your-secret-token
fly deploy
fly open /demo
```

Then share `https://rmg-rfid-ets.fly.dev/demo` with anyone — works from any browser, any computer.

---

## Simulation Scenarios

The demo simulation runs realistic production scenarios:

| Scenario | Probability | Flow |
|----------|------------|------|
| **QC Pass** | 70% | cutting → sewing → finishing → QC_PASS |
| **QC Fail** | 20% | cutting → sewing → finishing → QC_FAIL (with defect code) |
| **Rework** | 10% | cutting → sewing → finishing → QC_FAIL → sewing (rework) → QC_PASS |

Defect codes: `BROKEN_STITCH`, `SKIPPED_STITCH`, `UNEVEN_HEM`, `LOOSE_THREAD`, `MISALIGNED_SEAM`, `STAIN`

---

## Pilot Success Criteria

- Scan success rate **>= 99%** for valid RFID tags
- Median API response time **< 300ms** on LAN
- Station provision + map in **< 2 minutes**
- **Zero duplicate** state transitions (idempotency works)
- Clear operator feedback for all error states

---

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| Backend API (MVP) | Done | Station claim, events, bundles, admin CRUD |
| Station firmware | Done | ESP32 + MFRC522 RFID, LCD, touch, buzzer |
| Admin UI | Done | Station mapping, bundle management, live events |
| Simulation engine | Done | Terminal + web-based demo with realistic scenarios |
| Live demo dashboard | Done | Browser-based at `/demo` with pipeline visualization |
| Deployment config | Done | Dockerfile + Fly.io config |
| Comprehensive diagrams | Done | 8 Mermaid diagrams (architecture, data flow, state, ER, API map) |
| Cloud deployment | Next | Deploy to Fly.io for remote demo access |
| Operator identity | Planned | Badge/PIN for accountability |
| Offline buffering | Planned | Device-side queue for Wi-Fi drops |
| Analytics dashboards | Planned | Line throughput, bottlenecks, exceptions |

---

## Repository Structure

```
rmg-rfid-ets/
├── src/
│   ├── app.ts              # Express app factory
│   ├── server.ts           # Entry point
│   ├── db.ts               # Postgres pool
│   ├── auth.ts             # Station bearer auth
│   ├── adminAuth.ts        # Admin token auth
│   ├── ids.ts              # ID + token generation
│   ├── validation.ts       # Zod schemas
│   ├── simulation.ts       # Simulation engine (DB-direct)
│   └── routes/
│       ├── stations.ts     # Station claim
│       ├── events.ts       # Event ingest
│       ├── bundles.ts      # Bundle CRUD
│       ├── admin.ts        # Admin CRUD
│       ├── adminEvents.ts  # Event queries + SSE
│       ├── adminBundles.ts # Bundle admin
│       ├── stationStatus.ts # Heartbeat + /me
│       └── simulation.ts   # Simulation control API
├── public/
│   └── demo.html           # Self-contained demo dashboard
├── db/migrations/           # Idempotent SQL migrations
├── scripts/                 # Migrate, seed, simulate, deploy
├── test/                    # 8 test suites, 32 tests
├── docs/                    # Architecture, diagrams, CEO brief
├── Dockerfile               # Multi-stage production build
├── fly.toml                 # Fly.io deployment config
└── docker-compose.yml       # Local Postgres
```

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Developer guide (commands, architecture, patterns) |
| `NEXT_STEPS.md` | Pilot roadmap and phase plan |
| `docs/PROJECT_SUMMARY.md` | This document — full project overview |
| `docs/CEO_BRIEF.md` | One-page business + scope summary |
| `docs/ARCHITECTURE.md` | Technical architecture + contracts |
| `docs/DIAGRAMS.md` | 8 Mermaid diagrams (renders on GitHub) |
| `docs/README_PRESENTATION.md` | 5-minute talk track guide |

---

*RMG RFID ETS — Built by Southern IoT R&D*
