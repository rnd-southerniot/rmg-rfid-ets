# RMG RFID ETS — User Instructions

End-to-end runbook for bringing the full system online: Postgres → backend API → admin UI → ESP32 station firmware → live scans.

---

## 0. Prerequisites

| Tool                   | Version    | Verify             |
| ---------------------- | ---------- | ------------------ |
| Node.js                | 20+        | `node -v`          |
| npm                    | 10+        | `npm -v`           |
| Docker Desktop         | running    | `docker info`      |
| PlatformIO Core        | 6+         | `pio --version`    |
| Python 3               | 3.10+      | `python3 -V`       |
| `gh` CLI (for cloning) | logged in  | `gh auth status`   |

Hardware:

- ESP32-WROOM-32 dev board (one per station)
- MFRC522 RFID reader, ILI9341 LCD, FT6336 touch, RGB LED, piezo buzzer (per [src/config.h](../rmg-rfid-station-fw/src/config.h))
- USB-A → Micro-USB cable
- A 13.56 MHz MIFARE Classic 1K tag

Network: ESP32 must be on the same Wi-Fi LAN as the host running the backend.

---

## 1. Clone the two repos

```bash
mkdir -p ~/Developer/projects/prod && cd ~/Developer/projects/prod
git clone git@github.com:rnd-southerniot/rmg-rfid-ets.git
git clone git@github.com:rnd-southerniot/rmg-rfid-station-fw.git
```

---

## 2. Start Postgres

From `rmg-rfid-ets/`:

```bash
docker compose up -d
docker compose ps      # expect rmg-rfid-ets-db-1 Up, port 5434->5432
```

The host port is **5434** (compose maps `5434:5432` to avoid clashing with a system Postgres on 5432).

---

## 3. Backend configuration

```bash
cp .env.example .env  # if .env does not exist
```

Edit `.env`:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5434/rmg_rfid_ets
PORT=3003
LOG_LEVEL=info
ADMIN_TOKEN=<choose-a-strong-token>
SEED_FACTORY_CODE=SOUTHERNIOT-DEMO
SEED_FACTORY_NAME=SOUTHERNIOT-DEMO
SEED_LINES=L1,L2
```

Notes:

- `PORT=3003` matches the demo dashboard URL and admin UI Vite proxy.
- `DATABASE_URL` host port is **5434** (not 5432).
- `ADMIN_TOKEN` is required for every `/api/v1/admin/*` and `/api/v1/simulation/*` call. Treat as a secret.

Install + apply schema + seed:

```bash
npm install
npm run migrate    # applies db/migrations/*.sql in order
npm run seed       # creates SOUTHERNIOT-DEMO factory + L1, L2 lines
```

Start the backend (foreground, hot reload):

```bash
npm run dev
```

Expected log line: `Listening on :3003`. Leave this terminal running.

Verify: `curl -i http://127.0.0.1:3003/health` returns `{"ok":true}`.

---

## 4. Admin UI

In a new terminal:

```bash
cd rmg-rfid-ets/admin-ui
pnpm install
pnpm run dev
```

Expected: `VITE ... Local: http://localhost:5173/`. Open it in your browser.

The Vite dev server proxies `/api/*` and `/health` to <http://localhost:3003>. When the UI prompts for an admin token, use the value from `.env` (`ADMIN_TOKEN`).

---

## 5. Firmware: credentials

In `rmg-rfid-station-fw/`, create `include/credentials.h` from the example:

```bash
cp include/credentials.h.example include/credentials.h
```

Edit it with your factory Wi-Fi and the LAN IP of the host running the backend:

```c
#define WIFI_SSID     "<your-wifi-ssid>"
#define WIFI_PASSWORD "<your-wifi-password>"
#define SERVER_URL    "http://<host-lan-ip>:3003"
#define FACTORY_CODE  "SOUTHERNIOT-DEMO"
```

Get the host LAN IP with `ipconfig getifaddr en0` (Wi-Fi) or `en1` (Ethernet) on macOS, or `hostname -I` on Linux.

`include/credentials.h` is gitignored — never commit it.

---

## 6. Flash the ESP32

Plug the ESP32 in via USB and confirm the port:

```bash
ls /dev/cu.* | grep -iE 'usb|slab|wch'    # macOS
ls /dev/ttyUSB* /dev/ttyACM*              # Linux
```

Build and flash:

```bash
cd rmg-rfid-station-fw
pio run                                                     # build only (sanity check)
pio run -t upload --upload-port /dev/cu.usbserial-XXXX      # build + flash
```

Substitute the actual port. PlatformIO auto-detects if only one is connected.

Open the serial monitor (real terminal, not via wrapper):

```bash
pio device monitor -b 115200 -p /dev/cu.usbserial-XXXX
```

Expected boot sequence:

```text
[Main] === RMG RFID Station Firmware v0.1.0 ===
[POST] LCD=OK LED=OK Buzzer=OK RFID=OK Touch=OK
[WiFi] Connected: 192.168.x.y
[Main] MAC: AA:BB:CC:DD:EE:FF
[NTP] Synced: ...
[API] Claimed OK, token=sttok_...
[API] /me: mapped=0 station_id= type=
```

`mapped=0` is expected on first boot — the station has claimed itself but is not yet assigned a `station_id` / line / type.

---

## 7. Map the station

Two options.

### Option A — Admin UI (recommended)

1. Open <http://localhost:5173/>.
2. Go to the Stations page.
3. Find the row matching the MAC printed by the firmware boot log.
4. Set `station_id` (e.g. `L1-SW-01`), line (`L1` or `L2`), and type (`cutting` | `sewing` | `finishing` | `qc`).
5. Save.

### Option B — curl

```bash
ADMIN_TOKEN=<your-admin-token>
FACTORY=SOUTHERNIOT-DEMO

# Discover the unmapped station's primary key
curl -s -H "x-admin-token: $ADMIN_TOKEN" \
  "http://127.0.0.1:3003/api/v1/admin/stations?factory_code=$FACTORY" | python3 -m json.tool

# Map it
PK=st_xxxxxxxx_xxxxxxxxxxxxxxxxxxxx
curl -s -X PATCH \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"station_id":"L1-SW-01","line_name":"L1","type":"sewing"}' \
  "http://127.0.0.1:3003/api/v1/admin/stations/$PK/map"
```

Pull the new mapping into the firmware **immediately** by tapping the **REFRESH** button on the LCD (top-right corner). Otherwise the station polls `/me` every 5 minutes.

After refresh the serial log should show:

```text
[API] /me: mapped=1 station_id=L1-SW-01 type=sewing
```

---

## 8. Run a scan

1. Create a bundle and bind it to an RFID UID (admin UI → Bundles → New, or via `POST /api/v1/bundles`).
2. Tap the tag against the MFRC522 antenna.
3. Station beeps green and posts `COMPLETE` (or shows a QC PASS/FAIL touch prompt for QC-typed stations).
4. Watch live events:

   ```bash
   curl -N -H "x-admin-token: $ADMIN_TOKEN" \
     http://127.0.0.1:3003/api/v1/admin/events/stream
   ```

5. Or open the live demo dashboard at <http://localhost:3003/demo> for a visual pipeline.

---

## 9. Demo simulation (no hardware needed)

```bash
npm run simulate:demo                 # realistic 30-60 s steps
SIM_SPEED=fast npm run simulate:demo  # 5-10 s steps
```

Or drive the in-process engine via the dashboard at <http://localhost:3003/demo> (Start / Stop buttons, speed toggle, live event feed). Requires at least 2 mapped stations under `SOUTHERNIOT-DEMO`.

---

## 10. Flash a second (or Nth) ESP32

Same firmware, same `credentials.h`. The MAC uniquely identifies each board at the backend.

1. Unplug the previous ESP32 (or attach the new one to a different USB port — both will appear as separate `cu.usbserial-*` devices).
2. `pio run -t upload --upload-port /dev/cu.usbserial-NNN`.
3. The new station calls `/stations/claim` on first boot and shows up unmapped in the admin UI.
4. Map it to a different `station_id` (e.g. `L1-CT-01` cutting, `L1-FN-01` finishing, `L1-QC-01` qc) so the pipeline gets full coverage.

---

## 11. Shutdown

```bash
# Stop backend (foreground) and admin UI: Ctrl+C in each terminal
docker compose down            # stop Postgres (data persists in pgdata volume)
docker compose down -v         # nuke data — only if you want a clean slate
```

Power-cycle the ESP32 by unplugging USB. NVS keeps the station token, so on next boot it re-uses the same `sttok_*` and the existing mapping carries over.

---

## Troubleshooting

| Symptom                                                | Cause / Fix                                                                                                                                                            |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pio` build error: `'ledcSetup' was not declared`      | Platform resolved to `espressif32@6.13.0` (Arduino core 3.x). Pin in `platformio.ini`: `platform = espressif32@6.7.0`.                                                 |
| ESP32 boots but `[WiFi] Connecting..` forever          | Wrong SSID/password in `credentials.h`, or 5 GHz-only network (ESP32 needs 2.4 GHz).                                                                                   |
| `[API] Claim failed: HTTP -11` once at boot            | Transient DNS/connection error. Firmware retries automatically — ignore unless persistent.                                                                             |
| Station claims but `mapped=0` indefinitely             | You haven't mapped it yet (step 7), or the firmware hasn't polled. Tap REFRESH on the LCD.                                                                             |
| Backend `Cannot GET /api/v1/health`                    | The endpoint is `/health` (no `/api/v1` prefix).                                                                                                                       |
| Admin UI calls fail with 401                           | Wrong or missing `x-admin-token`. Verify it matches `.env`.                                                                                                            |
| Postgres connection refused                            | `docker compose ps` — if `db` container is down, `docker compose up -d`. Confirm `DATABASE_URL` uses port 5434, not 5432.                                              |
| GPIO12/15/2 boot loop                                  | Strapping pins held by peripheral at reset. Disconnect MFRC522 SS=15 / LCD CS=15 / DC=2 momentarily, then re-attach after boot. Long-term: rewire.                     |
| Serial monitor: `termios.error (19)`                   | `pio device monitor` was launched without a real TTY (e.g. via a non-interactive wrapper). Run it directly in your terminal.                                           |

---

## File map

| Path                                                     | Purpose                                       |
| -------------------------------------------------------- | --------------------------------------------- |
| [docker-compose.yml](docker-compose.yml)                 | Postgres for local dev                        |
| [.env.example](.env.example)                             | Backend env template                          |
| [src/server.ts](src/server.ts)                           | Backend entry, listens on `PORT`              |
| [src/routes/](src/routes/)                               | All HTTP routes                               |
| [admin-ui/](admin-ui/)                                   | Vite + React admin dashboard                  |
| [public/demo.html](public/demo.html)                     | Self-contained demo dashboard at `/demo`      |
| [scripts/simulateDemo.ts](scripts/simulateDemo.ts)       | CLI demo simulation                           |
| [docs/PROJECT_SUMMARY.md](docs/PROJECT_SUMMARY.md)       | Full project overview                         |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)             | Contracts and sequence diagrams               |
| `../rmg-rfid-station-fw/platformio.ini`                  | Firmware build config                         |
| `../rmg-rfid-station-fw/include/credentials.h`           | Wi-Fi + server URL (gitignored)               |
| `../rmg-rfid-station-fw/src/config.h`                    | Pin map + timing constants                    |
