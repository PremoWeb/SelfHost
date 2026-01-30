# Frontend Setup Guide

## Porting context

We are **porting from SvelteKit to Zig + Svelte**: the backend moves from SvelteKit/Bun to a Zig server, and the frontend stays Svelte but runs as a static SPA talking to the Zig API. The default `dev` and `build` scripts in this repo are for the **Zig + Svelte** target. Use `dev:kit` / `build:kit` when you need the original SvelteKit stack.

## Overview

The Svelte frontend is configured as a **static SPA** for the Zig backend. In development you run Vite with a proxy to the Zig API; in production Zig serves the built static files.

## Architecture

- **Single binary**: The Zig server serves both the Svelte frontend and `/api/*` from one process. Static files are read from a directory (default `./build`, or `STATIC_DIR` if set).
- **Backend**: Zig on port 3000 (API + WebSocket). Static dir defaults to `build` (relative to cwd) so the final binary serves the SPA and API together.
- **Frontend**: Svelte (SPA mode when building for Zig via `bun run build`).

## What’s Implemented

- **SPA build**: `svelte.config.js` uses `@sveltejs/adapter-static` when `BUILD_FOR_ZIG=true`. Root `+layout.ts` disables SSR and enables prerender for that build.
- **Vite proxy**: When `ZIG_BACKEND=true`, Vite proxies `/api` and `/ws` to `http://localhost:3000`.
- **API client**: `src/lib/api/client.ts` uses `baseURL: '/api'`; with the proxy, requests go to the Zig backend in dev.
- **Zig static serving**: If `STATIC_DIR` is set (e.g. `../build`), the Zig server serves files from that directory and falls back to `index.html` for SPA routes.
- **Frontend copy (frontend/)**: Run `frontend/bun run sync` to copy client-side code from `src/` into `frontend/src/`, strip server-only code, and deploy:
  - **Remote stubs** (all `*.remote.ts`): Rewired to call the Zig API where implemented (`getServerStatus` → GET `/api/servers/:id`; layout.remote → auth/session endpoints; others return “not implemented” until Zig adds them).
  - **Client loads** (`+page.ts`): Root and (app) list/detail pages fetch data from Zig API (servers, projects, server by id) so pages work with stubbed `+page.server.ts`.

## Development Workflow

**One command (Zig + UI together):**
```bash
bun run dev:all
```
Starts the Zig backend and Svelte dev server; open http://localhost:5173. Ctrl+C stops both.

**Or use two terminals:**

- **Terminal 1 – Zig backend:**  
  `cd zig && DATABASE_URL=file:../sqlite.db zig build run`
- **Terminal 2 – Svelte frontend:**  
  `bun run dev` (proxies `/api` and `/ws` to Zig)

- Frontend: http://localhost:5173  
- API/WS: proxied to http://localhost:3000  

For the original SvelteKit backend instead of Zig, use `bun run dev:kit`.

## Production Build (Zig + Svelte SPA)

### 1. Build the frontend

**Option A — from repo root** (uses `src/` with Zig flags):
```bash
bun run build
```
Output: `build/`.

**Option B — from extracted frontend** (uses `frontend/src/` synced from `src/`):
```bash
cd frontend && bun run sync && bun install && bun run build
```
Output: `frontend/build/`. Zig auto-detects `../frontend/build` when run from `zig/`.

### 2. Run Zig (serves SPA + API)
From `zig/` (binary auto-detects `../build` when run from `zig/`):
```bash
cd zig
export DATABASE_URL=file:../sqlite.db
zig build run
```
Static dir defaults to `build` (cwd) or `../build` if that exists (e.g. when run from `zig/`). Override with `STATIC_DIR` if needed.

- API: http://localhost:3000/api  
- App: http://localhost:3000/ (Zig serves `index.html` and static assets from the static dir)

## Scripts

| Script | Purpose |
|--------|---------|
| **`bun run dev:all`** | Zig backend + Svelte dev server (UI) in one command |
| **`bun run dev`** | Svelte dev server only (API/WS proxied to Zig; run Zig separately) |
| **`bun run build`** | Static SPA build for Zig → output in `build/` |
| `bun run dev:kit` | Dev server against SvelteKit backend (no Zig proxy) |
| `bun run build:kit` | SvelteKit build (e.g. Bun adapter) |

## Notes

- **Auth**: Zig auth endpoints are not implemented yet; `/api/auth/*` returns “not implemented”. The frontend auth client still points at the current origin; login will work only when Zig implements auth.
- **WebSocket**: Zig has a WebSocket handler; the frontend can use `/ws` when `ZIG_BACKEND=true` (proxied) or when served from Zig with `STATIC_DIR` set.
