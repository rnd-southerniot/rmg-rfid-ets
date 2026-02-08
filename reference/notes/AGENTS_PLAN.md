# Agent/workflow plan (recommended)

## One main project thread
Keep one dedicated chat/session for ETS/RFID dev to reduce context switching.

## Suggested sub-agents (spawn as needed)
1) **firmware-dev**
   - Works in `projects/rmg-rfid-station-fw`
   - Tasks: RC522 improvements, LCD/touch UI, queueing, buzzer tuning

2) **backend-dev**
   - Works in `projects/rmg-rfid-ets`
   - Tasks: endpoints, station auth, DB migrations, seed scripts, tests

3) **ui-dev**
   - Works in `projects/rmg-rfid-ets-ui`
   - Tasks: station mapping UI, live feed, diagnostics

4) **ops-sim**
   - Tasks: simulate flows, create bundles, verify events and station mapping quickly

## Conventions
- Use one canonical doc: `notes/ets-rfid-system-development/README.md`
- Capture every decision in `notes/ets-rfid-system-development/NEXT.md` + daily `memory/YYYY-MM-DD.md`.
- Before changing APIs/contracts, update README contract section.
