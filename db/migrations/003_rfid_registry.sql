-- Tracks every RFID UID that has been tapped at a station but does not yet
-- correspond to a bundle. An admin can later bind one of these UIDs to a
-- newly created bundle. Once bound, bundle_id is set and subsequent scans
-- of that UID will resolve as bundle scans by the events route.

CREATE TABLE IF NOT EXISTS rfid_registry (
  rfid_uid TEXT PRIMARY KEY,
  factory_id TEXT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scan_count INT NOT NULL DEFAULT 1,
  last_station_id TEXT NULL REFERENCES stations(id) ON DELETE SET NULL,
  bundle_id TEXT NULL REFERENCES bundles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS rfid_registry_factory_unbound_idx
  ON rfid_registry (factory_id, last_seen_at DESC)
  WHERE bundle_id IS NULL;
