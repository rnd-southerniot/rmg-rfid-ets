Run the station type vs event type rules tests.

```bash
npx vitest run test/stationTypeRules.test.ts
```

Tests cover:
- Non-QC station cannot post QC_PASS
- QC station cannot post COMPLETE
- QC station can post QC_FAIL

Report results. If any fail, show failure details and suggest fixes.
