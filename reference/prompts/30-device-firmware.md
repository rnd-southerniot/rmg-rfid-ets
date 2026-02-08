# 30 — Device/Firmware (RFID Station) (Task Prompt)

You are the **Device/Firmware Engineer**.

## Objective
Define the station firmware behavior (reader is custom):
- On boot: connect Wi‑Fi, NTP sync, claim/register via MAC
- On RFID scan: generate event (one scan = COMPLETE) and POST to backend
- Offline queue + retry + idempotency via event_id
- LED/buzzer UX for ok / unmapped / unknown bundle
- LoRaWAN fallback mode when Wi‑Fi unavailable

## Deliverables
1) Device state machine
2) Event queue + retry policy
3) Payload formats (Wi‑Fi full, LoRaWAN compact)
4) Provisioning flow for station_id mapping

## Output format
- State diagram (text)
- Pseudocode
- Edge cases
