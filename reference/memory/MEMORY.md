# MEMORY.md - Long-Term Memory

*Curated memories, lessons, and context that persist across sessions.*

---

## People

- **Arif** — Owner. IoT/embedded systems engineer. Building projects together.
- **Salma Shabnam** — Arif’s wife.
- **Aurjon** — Arif’s son.
- **Auritro** — Arif’s son.

## Projects

- **SCOMM CRM Frontend (Next.js)**
  - Repo path: `/Users/robotics/southerniot-scomm-crm-stack/scomm-crm/frontend`
  - Stack: Next.js 16 App Router + Turbopack + Tailwind v4 + Radix UI + Zustand + TanStack Query.
  - Notable config: `basePath` defaults to `/crm` (`next.config.ts`).
  - Docs added: `docs/DEVELOPMENT.md`, `docs/DEPLOYMENT.md`, `docs/STYLE.md`.

- **RMG RFID ETS (backend + station firmware + admin UI)**
  - Backend: `projects/rmg-rfid-ets` (Express + Postgres). Station endpoints: claim, heartbeat, `POST /api/v1/events` with `bundle.rfid_uid`.
  - Station firmware: `projects/rmg-rfid-station-fw` (ESP32, PlatformIO + ESP-IDF).
    - Peripherals: MFRC522 (HSPI), ILI9341 LCD (VSPI/SPI3 raw SPI), FT6336 touch (I2C), RGB LED + buzzer.
  - Admin UI: station mapping + monitoring.

## Preferences

### Field / interests (inferred from Mac + repos; 2026-02-06)
- **Core field:** end-to-end **IoT + embedded systems** engineering (device → connectivity → backend → dashboards/ops).
- **Connectivity focus:** **LoRaWAN/ChirpStack**, MQTT, gateway provisioning, production deployment patterns (Docker Compose stacks).
- **Embedded focus:** ESP32 firmware (ESP-IDF / PlatformIO), industrial comms (**RS485/Modbus**), device UX feedback (OLED/LED/buzzer), reliability (reconnect/buffering/idempotency).
- **Workflow/product focus:** factory/operations systems (RFID/ETS-style tracking), provisioning + CRM + observability.
- **Tooling interest:** AI-assisted development workflows (Claude/Codex prompt packs, hooks/templates); interest in MCP-style device/tool control.

*(Arif's preferences, habits, things he likes/dislikes)*

## Lessons Learned

*(Mistakes, insights, things to remember)*

## Important Dates

*(Birthdays, deadlines, recurring events)*

---

*Last updated: 2026-02-07*
