Run the API acceptance tests.

```bash
npx vitest run test/api.test.ts
```

Tests cover:
- Bundle creation (factory_code required, RFID normalization, hex validation)
- Event ingest (unmapped station, unknown bundle, idempotency)
- 7-byte UID end-to-end flow

Report results. If any fail, show failure details and suggest fixes.
