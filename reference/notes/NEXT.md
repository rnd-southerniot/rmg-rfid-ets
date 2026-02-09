# Next steps (ETS / RFID)

_Last updated: 2026-02-09 10:35 (GMT+6)_

## Current status (done)
- ✅ WiFi connect + station claim + periodic heartbeat
- ✅ MFRC522 UID read
- ✅ POST `/api/v1/events` with `bundle.rfid_uid` (uppercase hex)
- ✅ LCD (ILI9341 SPI) status UI + touch (FT6336) buttons (REFRESH, BUZ)
- ✅ Buzzer LEDC PWM tone + startup sweep
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
  - QC station mode with touch PASS/FAIL buttons (coded, untested on hardware)
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

## Next time (pick up here)
### 1) QC station mode test
- [ ] Map a station as `qc` type (or remap current station)
- [ ] Scan tag → verify PASS/FAIL touch buttons appear on LCD
- [ ] Touch PASS → event posted as `QC_PASS`
- [ ] Touch FAIL → event posted as `QC_FAIL`
- [ ] Timeout (10s no touch) → returns to READY without posting

### 2) Lock buzzer frequency
- [ ] Use current startup sweep to identify loudest/clearest frequency for the physical buzzer
- [ ] Set a constant (e.g. `BUZZ_FREQ_HZ`) and remove/disable sweep for normal boot (optional)
- [ ] Verify BUZ toggle uses the locked frequency

### 3) LCD/UI polish
- [ ] Only redraw when values change (reduce flicker)
- [ ] Status bar: WiFi signal, station ID, time

## Later
- [ ] UID cascade (7/10-byte) support if needed (MFRC522)
- [ ] OTA firmware updates (ArduinoOTA)
- [ ] Power-on self-test (LED, buzzer, RFID, LCD, WiFi)
- [ ] Serial debug log levels
