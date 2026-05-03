# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Admin UI for the RMG RFID ETS backend (`../` — Node/Express + Postgres). React 19 + Vite SPA for managing factories, lines, stations, bundles, and viewing event streams. Talks to the backend API via Vite dev proxy in development.

## Commands

```bash
npm run dev          # Vite dev server (port 5173) with API proxy
npm run build        # tsc -b && vite build (typecheck then bundle to dist/)
npm run lint         # ESLint
npm run preview      # Preview production build
```

No test runner configured.

## Backend Connection

Vite proxies `/api` and `/health` to the backend. Target read from `VITE_BACKEND_URL` in `.env` (default `http://localhost:3000`). See [vite.config.ts](vite.config.ts).

Backend runs in `../` — `npm run dev` there starts Express on the port set in its `.env` (commonly 3000 or 3003). Match `VITE_BACKEND_URL` to that port. Restart Vite after editing `.env`.

## Architecture

### Routing — TanStack Router (code-defined, not file-based)

All routes wired in [src/router.tsx](src/router.tsx). `/login` is unauthenticated; everything else nested under `authLayout` which wraps in `AppShell` and redirects to `/login` if no `admin_token` in localStorage. To add a route: import the page component, `createRoute({ getParentRoute: () => authLayout, ... })`, append to `routeTree`.

### Auth — admin token in localStorage

Single bearer mechanism: `admin_token` stored in localStorage by [auth-context.tsx](src/contexts/auth-context.tsx). Every API call sends it as `x-admin-token` header (see [src/lib/api.ts](src/lib/api.ts)). Backend validates against its `ADMIN_TOKEN` env var. No refresh, no expiry — token persists until logout.

### Data layer — TanStack Query + thin fetch wrapper

[src/lib/api.ts](src/lib/api.ts) exports per-resource functions (`fetchFactories`, `createLine`, etc.) wrapping a single `api<T>(path, token, options)` helper. Helper throws `ApiError(status, code, details)` on non-OK. All components consume via `useQuery`/`useMutation` keyed by resource. Default `staleTime: 30s`, `retry: 1` (set in [src/main.tsx](src/main.tsx)).

### Factory selection — global context

[factory-context.tsx](src/contexts/factory-context.tsx) fetches factories on mount (gated by `token`), auto-selects first or restores `selected_factory_code` from localStorage. Most resource pages (lines, stations, bundles) filter by `selected.code`.

### Event stream

[src/hooks/use-event-stream.ts](src/hooks/use-event-stream.ts) consumes backend SSE endpoint (`/api/v1/admin/events/stream`) for live event feed.

### UI — shadcn/ui + Tailwind v4

Components under `src/components/ui/` are shadcn-generated (see [components.json](components.json)). Tailwind v4 via `@tailwindcss/vite` plugin (no `tailwind.config`). Theme toggle via `next-themes`. Toasts via `sonner`. Forms: `react-hook-form` + `@hookform/resolvers/zod`.

### Path alias

`@/*` → `src/*` (configured in [tsconfig.json](tsconfig.json) and [vite.config.ts](vite.config.ts)).
