# RMG RFID ETS — Presentation Pack (CEO)

Use these three artifacts for a short leadership update:

1) `docs/CEO_BRIEF.md`
   - One-page business + scope summary

2) `docs/ARCHITECTURE.md`
   - Architecture and diagrams (Mermaid)

3) Demo flow (live):
   - Show admin station mapping
   - Show bundle creation + RFID assignment
   - Scan RFID at station → immediate feedback + backend event

4) **Web Demo Dashboard** (new):
   - Open `http://localhost:3003/demo` in a browser
   - Enter admin token, click Start
   - Watch pipeline light up, events stream in real-time, stats update live
   - Toggle between fast (5-10s) and realistic (30-60s) speed

## Suggested 5-minute talk track

- Problem: Bundle visibility gaps create delays and rework.
- Solution: RFID stations capture events; backend validates and records; admin UI maps and monitors.
- **Live demo**: Open `/demo` dashboard — start simulation, watch bundles flow through the pipeline in real-time. Show QC pass/fail/rework scenarios.
- Pilot: one line, one station type, COMPLETE event; measure scan success rate + provisioning time.
- Next: expand workflow events, operator identity, analytics.
