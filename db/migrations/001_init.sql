-- 001_init.sql
-- Minimal Postgres schema for MVP

CREATE TABLE IF NOT EXISTS factories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS lines (
  id TEXT PRIMARY KEY,
  factory_id TEXT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(factory_id, name)
);

CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,
  factory_id TEXT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  mac TEXT NOT NULL UNIQUE,
  station_id TEXT NULL,
  line_id TEXT NULL REFERENCES lines(id) ON DELETE SET NULL,
  type TEXT NULL,
  token_hash TEXT NULL,
  fw TEXT NULL,
  capabilities JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(factory_id, station_id)
);

CREATE TABLE IF NOT EXISTS bundles (
  id TEXT PRIMARY KEY,
  factory_id TEXT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  style TEXT NOT NULL,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  qty INT NOT NULL DEFAULT 10,
  line_route JSONB NULL,
  rfid_uid TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'created',
  current_station_id TEXT NULL REFERENCES stations(id) ON DELETE SET NULL,
  current_line_id TEXT NULL REFERENCES lines(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('created','in_progress','qc_pass','qc_fail','rework','packed'))
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  factory_id TEXT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  line_id TEXT NULL REFERENCES lines(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  meta JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (event_type IN ('COMPLETE','QC_PASS','QC_FAIL')),
  UNIQUE(station_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_events_bundle_ts ON events(bundle_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_station_ts ON events(station_id, ts DESC);

-- naive trigger-less updated_at handling; app should set updated_at explicitly
