# Zig + Svelte frontend

This directory is the **Zig backend frontend**: Svelte UI that talks to the Zig API. The source is synced from the SvelteKit app (`../src`) so we reuse the same components and routes without SvelteKit server code.

## Setup

1. **Sync** the UI from the SvelteKit side (run from repo root):
   ```bash
   cd frontend && bun run sync
   ```
2. **Install** (from `frontend/`):
   ```bash
   bun install
   ```

## Scripts

- **`bun run dev`** — Dev server with `/api` and `/ws` proxied to Zig (port 3000).
- **`bun run build`** — Static SPA → `build/` (Zig serves this with `STATIC_DIR=../frontend/build` or `../build`).
- **`bun run sync`** — Copy client-side code from `../src` and strip server-only files; run after changing UI in `../src`.

## Flow

- UI code lives in the main app at **`../src`** (lib, routes, components).
- **`scripts/sync-frontend-from-sveltekit.sh`** copies that into **`frontend/src`** and:
  - Removes: `lib/server`, `routes/api`, `routes/[namespace]`, `hooks.server.ts`; stubs all `+*.server.ts` to return empty/minimal data.
  - Overwrites all **`*.remote.ts`** with API-based stubs: `layout.remote`, `servers.remote`, `server.remote` (servers/[id]), `git.remote`, `ssh.remote`, `vps.remote`, `github.remote` — wired to Zig API where implemented (e.g. `getServerStatus` → GET `/api/servers/:id`).
  - Adds **client loads** (`+page.ts`) for root and (app) servers/projects/servers/[id] so pages fetch servers and projects from the Zig API.
- Build and run Zig with the frontend:
  - From repo root: `cd frontend && bun run build` → `frontend/build/`
  - Run Zig: `cd zig && STATIC_DIR=../frontend/build zig build run`

You can also keep using the **root** `bun run dev` / `bun run build` (they use `../src` with Zig flags); this `frontend/` copy is for a clean, Zig-only UI tree.
