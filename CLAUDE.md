# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SelfHost.gg is an open-source application deployment platform for self-hosting on your own infrastructure. It's actively being ported from a SvelteKit/Bun full-stack app to a **Zig backend + Svelte SPA frontend** on the `port/zig-svelte` branch.

## Development Commands

### Full-stack development (Zig backend + Svelte frontend)
```bash
bun run dev:all          # Starts both Zig backend (port 3000) and Svelte dev server (port 5173)
```

### Individual processes
```bash
bun run dev:zig          # Watch Zig files, auto-rebuild/restart on changes
bun run dev:ui           # Svelte dev server with API proxy to Zig backend
bun run dev              # Alias for dev:ui (ZIG_BACKEND=true)
```

### Building
```bash
bun run build            # Build frontend as static SPA for Zig (BUILD_FOR_ZIG=true)
cd zig && zig build      # Compile Zig server
cd zig && zig build run  # Compile and run Zig server
```

### Code quality
```bash
bun run check            # Type check (svelte-kit sync && svelte-check)
bun run lint             # Prettier + ESLint check
bun run format           # Auto-format with Prettier
```

### Testing
```bash
bun run test             # Run Vitest
bun run test -- --run path/to/test.ts  # Run a single test file
cd zig && zig build test # Run Zig unit tests
```

### Database
```bash
bun run db:generate      # Generate migrations from schema (drizzle-kit generate)
bun run db:push          # Push schema changes directly (dev only)
bun run db:studio        # Open Drizzle Studio GUI
```

## Architecture

### Two Stacks in Transition

The codebase contains both the **original SvelteKit full-stack** (`src/`) and the **new Zig+Svelte architecture** (`zig/` + `frontend/`). The `port/zig-svelte` branch is the active development branch for the port.

**Original stack** (`src/`): SvelteKit handles both UI and API, with Bun as the runtime.

**New stack** (`zig/` + `frontend/`):
- **Zig backend** serves the API on port 3000 using the Zap framework (wraps facil.io) with SQLite via C API
- **Svelte SPA frontend** is built as static files served by Zig in production; Vite dev server proxies `/api/*` and `/ws` to Zig in development

### Key Architectural Patterns

**Database**: SQLite with Drizzle ORM for schema/migration generation (TypeScript), but the Zig backend has its own migration runner (`zig/src/db/migrate.zig`) that reads the same Drizzle-generated SQL files from `drizzle/`. Schema changes go through `src/lib/server/db/schema.ts` → `bun run db:generate` → Zig auto-applies on startup.

**Real-time**: SQLite `update_hook()` → Zig detects INSERT/UPDATE/DELETE → broadcasts via WebSocket to connected Svelte clients. Implemented in `zig/src/db/realtime.zig`.

**Agent system**: Remote servers run a lightweight Bun-based agent (`agent/src/index.ts`) that makes an **outbound** WebSocket connection to the SelfHost server (no inbound ports needed). Agents report health metrics, accept remote commands, manage files, and handle WireGuard tunnels. Communication uses `x-selfhost-agent-id` and `x-selfhost-agent-key` headers.

**Auth/permissions**: Better Auth for authentication, Casbin for RBAC. The Zig backend implements its own session validation (`zig/src/auth/session.zig`) and permission checks (`zig/src/auth/permissions.zig`) with roles: isGod, isOwner, isAdmin.

**Multi-tenant model**: Users belong to Companies (organizations) via `company_members` with roles. Projects are scoped to companies. `company_resource_shares` enables cross-company resource sharing.

### Zig Backend Structure (`zig/src/`)
- `main.zig` — Entry point, CLI handling
- `server.zig` / `router.zig` — HTTP server and request routing
- `websocket.zig` / `agent_ws.zig` — WebSocket handling and agent connections
- `db/` — Database layer (SQLite bindings, migrations, query helpers, realtime hooks)
- `auth/` — Middleware, session management, permissions
- `services/` — Business logic (servers, companies, projects, VPS providers, cloudflare tokens)
- `utils/` — UUID generation, JSON parsing, request body reading

### Frontend Structure (`frontend/src/`)
- `lib/api/` — Axios-based API client with resource-specific methods
- `lib/components/ui/` — Shadcn/Svelte components
- `lib/stores/` — Svelte stores (auth, team, websocket)
- `routes/(app)/` — Authenticated app routes
- `routes/(public)/` — Public routes

## Code Style

### TypeScript/Svelte
- **Package manager**: Always use `bun`, never `npm` or `node`
- **Formatting**: Tabs, single quotes, no trailing commas, 100 char width (configured in `.prettierrc`)
- **Svelte**: Use Svelte 5 Runes API (`$state()`, `$derived()`, `$effect()`, `$props()`)
- **State management**: TanStack Query (`@tanstack/svelte-query`) for server state

### UI Design Rules
- Use Shadcn-Svelte component defaults — no custom border-radius (`rounded-3xl`, `rounded-full` on cards) or non-standard shadows
- Standard sentence/title casing — avoid `uppercase` classes on main UI elements
- Full width layouts — avoid `max-w-7xl` on main wrappers
- Light theme is the primary experience
- Icons from `lucide-svelte`

### Zig
- Links against SQLite3, facil.io (via Zap), libc, and libc++
- Cross-compilation targets: x86_64, ARM64, ARMv6 (musl static linking for Raspberry Pi)

## Environment

Copy `.env.example` to `.env`. Key variables:
- `DATABASE_URL` — SQLite path (default: `file:sqlite.db`)
- `ZIG_BACKEND=true` — Set automatically by dev scripts; makes Vite proxy to Zig
- `BUILD_FOR_ZIG=true` — Builds frontend as static SPA instead of SvelteKit server
- `SELFHOST_DEV=1` — Enables dev features (Magic Tunnel, etc.)
