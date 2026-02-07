-- 002_station_last_seen.sql

ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_stations_factory_last_seen ON stations(factory_id, last_seen_at DESC);
