# Mermaid Export Instructions

These diagrams were exported using `@mermaid-js/mermaid-cli` (mmdc) via `npx`.

## Export commands

From repo root:

```bash
# Architecture flow
npx -y @mermaid-js/mermaid-cli@latest \
  -i docs/exports/architecture-flow.mmd \
  -o docs/exports/architecture-flow.png

# Sequence: provisioning + mapping
npx -y @mermaid-js/mermaid-cli@latest \
  -i docs/exports/sequence-provisioning.mmd \
  -o docs/exports/sequence-provisioning.png

# Sequence: scan event
npx -y @mermaid-js/mermaid-cli@latest \
  -i docs/exports/sequence-scan-event.mmd \
  -o docs/exports/sequence-scan-event.png
```

## Outputs

- `architecture-flow.png`
- `sequence-provisioning.png`
- `sequence-scan-event.png`
