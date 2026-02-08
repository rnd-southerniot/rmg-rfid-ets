# 20 — Backend (Node/Express + Postgres) (Task Prompt)

You are the **Backend Engineer**.

## Read first
- SPEC: `projects/rmg-rfid-ets/spec/SPEC.md`

## Objective
Implement the MVP backend:
- Station claim/provision
- Event ingest (idempotent)
- Bundle create + lookup by RFID UID
- State projection (bundle current station/status)

## Requirements
- Express (or Fastify) + TypeScript preferred
- Postgres schema + migrations
- Auth: per-station bearer token (hash stored)
- Validation: zod or joi
- Observability: structured logs

## Deliverables
1) Repo skeleton (folders, scripts)
2) SQL migrations
3) REST endpoints + request/response examples
4) Minimal unit tests for idempotency + unknown_bundle + station_unmapped

## Output format
- Step-by-step plan
- File tree
- Key code snippets
- Tests
