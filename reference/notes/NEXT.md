# Next steps (ETS / RFID)

_Last updated: 2026-02-07 14:27 (GMT+6)_

## Current status (done)
- ✅ WiFi connect + station claim + periodic heartbeat
- ✅ MFRC522 UID read
- ✅ POST `/api/v1/events` with `bundle.rfid_uid` (uppercase hex)
- ✅ LCD (ILI9341 SPI) status UI + touch (FT6336) buttons (REFRESH, BUZ)
- ✅ Buzzer LEDC PWM tone + startup sweep
- ✅ Backend `projects/rmg-rfid-ets`: `/api/v1/events` ingest + station mapping

## Next time (pick up here)
### 1) RFID end-to-end test
Goal: prove “scan → backend → UI” end-to-end with one known tag.

Checklist:
- [ ] Backend running locally or on dev server; you know the base URL the station is pointed at
- [ ] Station is mapped + online (admin UI shows station_id and last heartbeat)
- [ ] Pick one physical RFID tag/card to be the test tag
- [ ] Determine its UID (from station serial log) and record it here: `______________`
- [ ] Seed/create a bundle record in backend DB with that exact `rfid_uid`
- [ ] Scan tag again:
  - [ ] Station shows UID on LCD and serial
  - [ ] Station sends `POST /api/v1/events` and gets `{ok:true}`
  - [ ] Backend persists event (and links to bundle)
  - [ ] Admin UI live feed (or events page) updates
- [ ] Negative test: scan an *unknown* tag and verify backend returns/records expected error/unknown flow

Artifacts to capture:
- Station serial log snippet (one scan)
- Backend log snippet (ingest)
- Screenshot of admin UI showing the event

### 2) Lock buzzer frequency
- [ ] Use current startup sweep to identify loudest/clearest frequency for the physical buzzer
- [ ] Set a constant (e.g. `BUZZ_FREQ_HZ`) and remove/disable sweep for normal boot (optional)
- [ ] Verify BUZ toggle uses the locked frequency

## Later
- Firmware robustness:
  - [ ] UID cascade (7/10-byte) support if needed (MFRC522)
  - [ ] Offline queue/buffering when WiFi/backend down (optional, but useful)
- LCD/UI polish:
  - [ ] Only redraw when values change (reduce flicker)
  - [ ] Show mapping details from `/api/v1/station/me` (station_id/line/type)
