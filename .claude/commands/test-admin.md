Run the admin API tests.

```bash
npx vitest run test/admin.test.ts
```

Tests cover:
- Admin auth (x-admin-token required)
- Station mapping (map, duplicate station_id rejection, unmap, 404)
- Unmapped station blocks event ingest

Report results. If any fail, show failure details and suggest fixes.
