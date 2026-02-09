Run the admin bundles API tests.

```bash
npx vitest run test/adminBundles.test.ts
```

Tests cover:
- Admin auth required
- List bundles by factory
- Filter by status, RFID partial match
- Pagination
- Bundle event timeline (chronological, 404, empty)

Report results. If any fail, show failure details and suggest fixes.
