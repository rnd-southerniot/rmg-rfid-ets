# ETS / RFID System Development

This folder is the working hub for the RMG RFID ETS system: backend + station firmware + admin UI.

## Repos (workspace paths)
- Backend: `projects/rmg-rfid-ets`
- Station firmware (ESP32 / PlatformIO / ESP-IDF): `projects/rmg-rfid-station-fw`
- Admin UI: `projects/rmg-rfid-ets-ui`

## Key contracts
- Station claim: `POST /api/v1/stations/claim`
- Station heartbeat: `POST /api/v1/station/heartbeat`
- Station events ingest: `POST /api/v1/events`
  - Body: `{ event_id, ts, bundle:{rfid_uid}, event_type }`
  - `rfid_uid` sent as uppercase hex string (no separators) from station.

## Hardware wiring (current)
- LCD (ILI9341 SPI): CS=GPIO15, RST=GPIO4, DC=GPIO2, MOSI=GPIO23, SCK=GPIO18, MISO=GPIO19 (opt)
- Touch (FT6336 I2C): SDA=GPIO21, SCL=GPIO22, RST=GPIO25 (opt)
- RFID (MFRC522 SPI / HSPI): SS=GPIO5, SCK=GPIO14, MOSI=GPIO13, MISO=GPIO12, RST=NC
- Buzzer: GPIO33 (LEDC PWM tone)
- RGB (active cathode): R=GPIO32, G=GPIO26, B=GPIO27

## Current station mapping (dev)
- Factory code: `SOUTHERNIOT-DEMO`
- Real station MAC: `10:97:BD:5A:23:04`
- Mapped station_id: `L1-SW-01` (line `L1`, type `sewing`)

## Touch calibration (UI 320x240 landscape)
- top-left raw(0,293) -> ui(0,0)
- top-right raw(12,3) -> ui(319,0)
- bottom-left raw(239,292) -> ui(0,239)

## Firmware UI
- LCD status screen + touch buttons:
  - Top-right: REFRESH (force `/api/v1/station/me` poll)
  - Bottom-left: BUZ toggle
  - Crosshair shows last touch

## Next steps
See `NEXT.md`.
