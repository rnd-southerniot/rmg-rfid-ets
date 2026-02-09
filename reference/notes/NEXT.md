# Next steps (ETS / RFID)

_Last updated: 2026-02-09 14:30 (GMT+6)_

## Current status (done)
- ✅ WiFi connect + station claim + periodic heartbeat
- ✅ MFRC522 UID read
- ✅ POST `/api/v1/events` with `bundle.rfid_uid` (uppercase hex)
- ✅ LCD (ILI9341 SPI) status UI + touch (FT6336) buttons (REFRESH, BUZ)
- ✅ Buzzer LEDC PWM tone, locked to 2700 Hz (piezo resonant)
- ✅ Backend `projects/rmg-rfid-ets`: `/api/v1/events` ingest + station mapping
- ✅ Admin UI (React 19 + Vite + TanStack Router/Query + Tailwind v4 + shadcn/ui)
  - Stations list + map/unmap dialogs
  - Bundles list with filters + single/bulk create
  - Live SSE event feed + recent events table
  - Factory/line CRUD in settings
- ✅ Firmware rewrite (PlatformIO, Arduino framework, full state machine)
  - Repo: `rnd-southerniot/rmg-rfid-station-fw` (private)
  - State machine: BOOT → WiFi → NTP → CLAIM → CHECK_MAPPING → READY → SCAN
  - Dual SPI: LCD on VSPI, RFID on HSPI
  - NVS persistence for token + station config
  - RGB LED + buzzer feedback per scan result
  - QC station mode with touch PASS/FAIL buttons
- ✅ RFID end-to-end test (2026-02-09)
  - Test station MAC: `A8:42:E3:32:A4:98`, mapped as L1-SW-01 / sewing
  - Test tag UID: `0B7D0610`
  - Scan → POST event → 200 OK → event persisted with bundle link
  - Unknown tag → 404 → yellow LED + warning beep
  - Heartbeats flowing every 60s
- ✅ Offline queue test (2026-02-09)
  - Killed backend → scanned tags → events queued to NVS (queue size: 2)
  - Restarted backend → queue flushed automatically → events posted with 200 OK
  - No events lost; timestamps preserved from original scan time
- ✅ QC station mode test (2026-02-09)
  - Remapped station to `qc` type (L1-QC-01)
  - Scan tag → PASS/FAIL touch buttons appeared on LCD
  - Touch PASS → event posted as `QC_PASS` → 200 OK
  - Touch FAIL → event posted as `QC_FAIL` → 200 OK
  - Timeout not explicitly tested (10s no-touch auto-cancel)
- ✅ Buzzer frequency locked (2026-02-09)
  - Ran frequency sweep 500-4000 Hz on hardware
  - Locked `BUZZER_FREQ_HZ` to 2700 Hz in `config.h`
  - Success: 2700 Hz, Warning: 2025 Hz (double beep), Error: 1350 Hz
  - Sweep removed from boot
- ✅ LCD/UI polish (2026-02-09)
  - Screen tracking to skip redundant full redraws (no flicker on scan→ready transition)
  - Status bar on ready screen: WiFi status, station ID, HH:MM time (updates every 2s)
  - Moved scan prompt up to make room for status bar
- ✅ OTA firmware updates (2026-02-09)
  - ArduinoOTA with hostname `rfid-<MAC>` for network discovery
  - LCD progress display during update
  - LED feedback: blue=updating, green=done, red=error
  - Usage: `pio run -t upload --upload-port <ESP32_IP>`
- ✅ Power-on self-test (2026-02-09)
  - Tests LCD, LED (R/G/B flash), buzzer (beep), RFID (version reg), touch (I2C probe)
  - Results displayed on LCD checklist for 1.5s
  - Serial output: `[POST] LCD=OK LED=OK Buzzer=OK RFID=OK Touch=OK`
- ✅ Serial debug log levels (2026-02-09)
  - Created `log.h` with compile-time LOG_E/LOG_W/LOG_I/LOG_D macros
  - `LOG_LEVEL 2` (INFO) in `config.h` — change to 3 for DEBUG, 0 for ERROR-only
  - All Serial.printf/println calls replaced across all 11 source files
  - Verified on hardware: log output working correctly

## Next time (pick up here)
All core features and nice-to-haves are done. Remaining:

## Later
- ✅ UID cascade (7/10-byte) support (2026-02-09)
  - Backend `RfidUidSchema` now validates hex-only + even-length (whole bytes)
  - No length restriction — works for 4-byte (CL1), 7-byte (CL2), 10-byte (CL3), and UHF EPCs
  - Firmware already handles cascade levels via `mfrc522.uid.size` — no changes needed
  - Tests added for 7-byte UID end-to-end flow and non-hex rejection
