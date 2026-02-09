Spin up the full stack and run the live demo simulation. Follow these steps in order:

1. Start Postgres:
```bash
docker compose up -d
```

2. Wait for Postgres to be ready, then run migrations and seed:
```bash
npm run migrate
npm run seed
```

3. Start the dev server in the background:
```bash
npm run dev
```

4. Verify the server is responding:
```bash
curl -s http://127.0.0.1:3003/health
```

5. Check for mapped stations:
```bash
curl -s 'http://127.0.0.1:3003/api/v1/admin/stations?factory_code=SOUTHERNIOT-DEMO' -H 'x-admin-token: demo-admin-token'
```

6. If fewer than 2 mapped stations exist, create and map them. Claim 4 stations with fixed MACs (AA:BB:CC:DD:EE:01 through 04), then map them via PATCH /api/v1/admin/stations/:id/map as:
   - AA:BB:CC:DD:EE:01 -> station_id: L1-SW-01, line_name: L1, type: sewing
   - AA:BB:CC:DD:EE:02 -> station_id: L1-SW-02, line_name: L1, type: sewing
   - AA:BB:CC:DD:EE:03 -> station_id: L1-FIN-01, line_name: L1, type: finishing
   - AA:BB:CC:DD:EE:04 -> station_id: L1-QC-01, line_name: L1, type: qc

7. Run the simulation in fast mode:
```bash
SIM_SPEED=fast npm run simulate:demo
```

Report the banner output and first few bundle results. The simulation runs continuously until Ctrl+C.

Environment variables (from .env):
- ADMIN_TOKEN — required
- SEED_FACTORY_CODE — defaults to SOUTHERNIOT-DEMO
- SIM_SPEED — 'fast' (5-10s) or 'realistic' (30-60s, default)
