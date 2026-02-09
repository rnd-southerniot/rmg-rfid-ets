Run the bulk bundle creation tests.

```bash
npx vitest run test/bulkBundles.test.ts
```

Tests cover:
- Bulk create multiple bundles
- Partial failure on duplicate RFIDs
- Invalid payload rejection
- RFID UID uppercase normalization
- Unknown factory per-item error

Report results. If any fail, show failure details and suggest fixes.
