# RMG RFID ETS — Diagrams

All diagrams in Mermaid format. Render in GitHub, VS Code (Mermaid extension), or any Mermaid-compatible viewer.

---

## 1. System Architecture

High-level view of all system components and their connections.

```mermaid
flowchart TB
  subgraph FF["Factory Floor"]
    ST1["RFID Station 1\nESP32 + MFRC522\nCutting"]
    ST2["RFID Station 2\nESP32 + MFRC522\nSewing"]
    ST3["RFID Station 3\nESP32 + MFRC522\nFinishing"]
    ST4["RFID Station 4\nESP32 + MFRC522\nQC"]
  end

  subgraph BE["Backend (Node/Express)"]
    API["/api/v1\nREST API"]
    AUTH["Auth Layer\nStation Bearer + Admin Token"]
    SIM["Simulation Engine\nIn-process bundle flow"]
    SSE["SSE Streams\nReal-time events + logs"]
  end

  subgraph DB["Database"]
    PG[("Postgres 16\nfactories | lines | stations\nbundles | events")]
  end

  subgraph WEB["Web Clients"]
    ADMIN["Admin UI\nStation mapping\nBundle management"]
    DEMO["Demo Dashboard\n/demo\nLive pipeline + stats"]
  end

  ST1 & ST2 & ST3 & ST4 -- "Wi-Fi / HTTP\nBearer token" --> AUTH
  AUTH --> API
  API --> PG
  SIM -- "Direct DB writes" --> PG
  SSE -- "Poll DB" --> PG
  ADMIN -- "HTTPS\nx-admin-token" --> API
  DEMO -- "HTTPS + SSE\nadmin_token" --> API
  DEMO -.-> SSE
```

---

## 2. Data Flow Diagram

How data moves from RFID scan to database to real-time display.

```mermaid
flowchart LR
  subgraph Input["Data Sources"]
    RFID["RFID Tag\n(UID bytes)"]
    OP["Operator\n(places bundle)"]
  end

  subgraph Station["ESP32 Station"]
    READ["MFRC522\nRead UID"]
    DEDUP["De-dup\n(suppress repeat reads)"]
    POST["HTTP POST\n/api/v1/events"]
  end

  subgraph Backend["Backend API"]
    VAL["Validate\n- Station mapped?\n- Bundle exists?\n- Event type allowed?"]
    WRITE["Write Event\n(idempotent INSERT)"]
    UPDATE["Update Bundle\nstatus + current_station"]
  end

  subgraph Storage["Postgres"]
    EVT[("events\nappend-only log")]
    BDL[("bundles\ncurrent state")]
  end

  subgraph Output["Real-time Output"]
    SSE1["SSE /admin/events/stream\n(poll-based)"]
    SSE2["SSE /simulation/log\n(push-based)"]
    DASH["Demo Dashboard\nPipeline + Feed + Stats"]
    ADMINUI["Admin UI\nEvent timeline"]
  end

  RFID --> READ
  OP -.-> RFID
  READ --> DEDUP --> POST
  POST --> VAL --> WRITE --> EVT
  WRITE --> UPDATE --> BDL
  EVT --> SSE1 --> ADMINUI
  EVT --> SSE2 --> DASH
  BDL --> SSE1
```

---

## 3. Bundle State Diagram

Lifecycle of a bundle from creation to final QC outcome.

```mermaid
stateDiagram-v2
  [*] --> created : POST /bundles\n(assign RFID UID)

  created --> in_progress : COMPLETE event\n(any non-QC station)

  in_progress --> in_progress : COMPLETE event\n(next station in pipeline)

  in_progress --> qc_pass : QC_PASS event\n(QC station)
  in_progress --> qc_fail : QC_FAIL event\n(QC station)

  qc_fail --> in_progress : COMPLETE event\n(rework at sewing)

  qc_pass --> [*]
  qc_fail --> [*] : No rework

  note right of created : Bundle exists but\nhasn't been scanned yet
  note right of in_progress : Flowing through\nthe production line
  note left of qc_pass : Passed quality check
  note left of qc_fail : Failed quality check\nMay trigger rework
```

---

## 4. Station Lifecycle Diagram

How a station goes from unconfigured hardware to active scanning.

```mermaid
stateDiagram-v2
  [*] --> unclaimed : Power on

  unclaimed --> claimed : POST /stations/claim\n(MAC + factory_code)\nReceives bearer token

  claimed --> mapped : PATCH /admin/stations/:id/map\n(station_id + line + type)

  mapped --> active : First heartbeat or event

  active --> active : Heartbeat every 30s\nUpdates last_seen_at

  active --> stale : No heartbeat > 2min

  stale --> active : Heartbeat received

  mapped --> unmapped : PATCH /admin/stations/:id/unmap

  unmapped --> mapped : Re-mapped by admin

  note right of claimed : Has token but no\nstation_id/line/type.\nCannot post events.
  note right of mapped : Ready to post events.\nWaiting for first scan.
  note left of active : Posting events +\nperiodic heartbeats
```

---

## 5. Event Ingest Sequence

Detailed sequence of what happens when a station posts an event.

```mermaid
sequenceDiagram
  participant S as ESP32 Station
  participant A as Backend API
  participant D as Postgres

  S->>S: MFRC522 reads RFID UID
  S->>S: De-dup check (suppress if < 3s)
  S->>A: POST /api/v1/events<br/>Authorization: Bearer sttok_xxx<br/>{event_id, ts, bundle: {rfid_uid}, event_type}

  A->>D: SELECT station by token_hash
  alt Token invalid
    A-->>S: 401 Unauthorized
  end

  A->>A: Check station is mapped (station_id, line_id, type)
  alt Station unmapped
    A-->>S: 409 station_unmapped
  end

  A->>A: Check event_type vs station type
  alt Type mismatch (e.g. COMPLETE at QC station)
    A-->>S: 409 station_type_mismatch
  end

  A->>D: SELECT bundle by rfid_uid
  alt Bundle not found
    A-->>S: 404 unknown_bundle
  end

  A->>D: INSERT event (ON CONFLICT DO NOTHING)
  alt New event
    A->>D: UPDATE bundle SET status, current_station
  end

  A-->>S: 200 {ok: true}
  S->>S: Green LED + beep (success)
```

---

## 6. Demo Simulation Flow

How the web demo dashboard drives the simulation.

```mermaid
sequenceDiagram
  participant B as Browser (/demo)
  participant A as Backend API
  participant E as SimulationEngine
  participant D as Postgres

  B->>A: POST /simulation/start {speed: "fast"}
  A->>E: new SimulationEngine(db, factory, speed)
  A->>E: engine.start() [async, non-blocking]
  A-->>B: {ok: true}

  B->>A: GET /simulation/log (SSE)
  A-->>B: event: hello

  loop Every bundle
    E->>D: SELECT mapped stations
    E->>D: INSERT bundle (rfid_uid)
    E-->>B: event: log {type: "bundle", ...}

    loop Each station in pipeline
      E->>E: sleep(5-10s)
      E->>D: INSERT event (COMPLETE)
      E->>D: UPDATE bundle status
      E-->>B: event: log {type: "event", ...}
    end

    alt QC Pass (70%)
      E->>D: INSERT event (QC_PASS)
      E-->>B: event: log {type: "qc_pass"}
    else QC Fail (20%)
      E->>D: INSERT event (QC_FAIL)
      E-->>B: event: log {type: "qc_fail"}
    else Rework (10%)
      E->>D: INSERT event (QC_FAIL)
      E->>D: INSERT events (rework COMPLETE)
      E->>D: INSERT event (QC_PASS)
      E-->>B: event: log {type: "rework"}
    end

    E-->>B: event: log {type: "done", stats}
  end

  B->>A: POST /simulation/stop
  A->>E: engine.stop()
  A-->>B: {ok: true, stats}
```

---

## 7. Database Entity Relationship

```mermaid
erDiagram
  factories ||--o{ lines : "has"
  factories ||--o{ stations : "has"
  factories ||--o{ bundles : "has"
  factories ||--o{ events : "has"

  lines ||--o{ stations : "assigned to"
  lines ||--o{ events : "recorded at"

  stations ||--o{ events : "emits"

  bundles ||--o{ events : "tracked by"

  factories {
    text id PK
    text name
    text code UK
  }

  lines {
    text id PK
    text factory_id FK
    text name
  }

  stations {
    text id PK
    text factory_id FK
    text mac UK
    text station_id "nullable, unique per factory"
    text line_id FK "nullable"
    text type "cutting|sewing|finishing|qc"
    text token_hash "SHA-256 of bearer token"
    text fw "firmware version"
    jsonb capabilities
    timestamptz last_seen_at
    timestamptz created_at
    timestamptz updated_at
  }

  bundles {
    text id PK
    text factory_id FK
    text order_id
    text style
    text color
    text size
    int qty
    text rfid_uid UK
    text status "created|in_progress|qc_pass|qc_fail|rework|packed"
    text current_station_id FK
    text current_line_id FK
    timestamptz updated_at
  }

  events {
    text id PK
    text factory_id FK
    text event_id "unique per station"
    text bundle_id FK
    text station_id FK
    text line_id FK
    text event_type "COMPLETE|QC_PASS|QC_FAIL"
    timestamptz ts
    jsonb meta "defects, photos, sim flag"
    timestamptz created_at
  }
```

---

## 8. API Route Map

```mermaid
flowchart TB
  ROOT["/api/v1"]

  ROOT --> STATIONS["/stations"]
  STATIONS --> CLAIM["POST /claim\nStation provisioning"]

  ROOT --> STATION["/station"]
  STATION --> HB["POST /heartbeat\nStation heartbeat"]
  STATION --> ME["GET /me\nStation self-introspection"]

  ROOT --> EVENTS["/events"]
  EVENTS --> POST_EVT["POST /\nEvent ingest"]

  ROOT --> BUNDLES["/bundles"]
  BUNDLES --> POST_BDL["POST /\nCreate bundle"]
  BUNDLES --> POST_BULK["POST /bulk\nBulk create"]
  BUNDLES --> GET_RFID["GET /by-rfid/:uid\nLookup by RFID"]

  ROOT --> ADMIN["/admin"]
  ADMIN --> FACTORIES["GET|POST /factories"]
  ADMIN --> LINES["GET|POST /lines"]
  ADMIN --> ADM_STATIONS["GET /stations"]
  ADM_STATIONS --> MAP["PATCH /:id/map"]
  ADM_STATIONS --> UNMAP["PATCH /:id/unmap"]
  ADMIN --> ADM_EVT["/events"]
  ADM_EVT --> RECENT["GET /recent"]
  ADM_EVT --> STREAM["GET /stream (SSE)"]
  ADMIN --> ADM_BDL["/bundles"]

  ROOT --> SIM["/simulation"]
  SIM --> START["POST /start"]
  SIM --> STOP["POST /stop"]
  SIM --> STATUS["GET /status"]
  SIM --> LOG["GET /log (SSE)"]

  style CLAIM fill:#2d5a3d,stroke:#3dd68c
  style POST_EVT fill:#2d5a3d,stroke:#3dd68c
  style STREAM fill:#2d4a5a,stroke:#63b3ed
  style LOG fill:#2d4a5a,stroke:#63b3ed
  style START fill:#5a4a2d,stroke:#ecc94b
  style STOP fill:#5a2d2d,stroke:#f56565
```
