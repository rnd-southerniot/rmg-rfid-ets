Run the station heartbeat test.

```bash
npx vitest run test/heartbeat.test.ts
```

Tests: POST /api/v1/station/heartbeat sets last_seen_at.

Report results. If it fails, show failure details and suggest fixes.
