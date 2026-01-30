# Project Porting Guide: Zig + Svelte Architecture

This document outlines the technical design and migration path for transitioning the `selfhost` platform from SvelteKit/Bun to a **Zig backend** and **Svelte SPA frontend**.

## 1. Primary Objectives

- **Universal Architecture Support**: Native support for x86_64, ARM64, and **ARMv6 (Raspberry Pi Zero W)** via static linking with musl.
- **Resource Efficiency**: Minimal RAM and CPU footprint for low-power devices.
- **Real-time Reactive UI**: Leveraging SQLite's internal update notifications to push data to the frontend.

## 2. Infrastructure & Branching

- **Branch**: All porting work will occur on the `port/zig-svelte` branch.
- **Coexistence**: The Zig server will be built incrementally while the current Bun server remains functional for comparison during development.

## 3. Backend Technical Stack (Zig)

- **Runtime**: No runtime (Bare Metal/Static Binary).
- **HTTP/WebSocket**: [Zap](https://github.com/zigzap/zap) (Wraps `facil.io`).
- **Database**: SQLite (via `cImport` for direct C-API access).
- **Migrations**: Zig-based migration system (Drizzle-like) - see `zig-migrate-proposal.md`.
- **Permissions**: Casbin (C version).
- **SSH**: `libssh2`.

### SQLite Real-time Notifications

We will utilize the `sqlite3_update_hook()` feature:

1. Zig registers a callback function with SQLite.
2. Whenever a `COMMIT` happens that affects a table, SQLite notifies Zig with the operation type (INSERT/UPDATE/DELETE), Table Name, and RowID.
3. Zig publishes this event to a WebSocket broadcast group.
4. Svelte clients receive the event and refresh only the relevant data.

### Multi-Threaded Worker Pool

Non-blocking operations will be moved to a background worker pool using `std.Thread`:

- **SSH Active Connections**: Managed in background threads to prevent blocking the HTTP loop.
- **Tunnel Management**: Child processes for `cloudflared` managed via `std.ChildProcess`.
- **System Monitoring**: Periodic background scans for CPU/Memory/Disk stats.

## 4. Frontend Architecture (Svelte SPA)

- **Framework**: Svelte 5.
- **Mode**: Static Site Generation (SSG/SPA).
- **Communication**:
  - REST/JSON API for commands.
  - WebSockets for real-time telemetry and UI synchronization.
- **Scripts**: Default `bun run dev` and `bun run build` target Zig + Svelte (proxy to Zig in dev, static SPA output for Zig in prod). See `zig/FRONTEND_SETUP.md`. Use `dev:kit` / `build:kit` for the original SvelteKit stack.

## 5. Migration Checklist

- [ ] Initialize `port/zig-svelte` branch.
- [ ] Setup `build.zig` with cross-compilation targets (`arm-linux-musleabihf`).
- [ ] Implement Zap-based HTTP/WS boilerplate.
- [ ] Port Drizzle schema to Zig schema definitions (comptime).
- [ ] Build `zig-migrate` CLI tool for migration generation (or use hybrid approach with Drizzle Kit).
- [ ] Implement migration runner in Zig (reuses existing SQL migration files).
- [ ] Implement SQLite `update_hook` -> WebSocket bridge.
- [ ] Build background worker logic for `cloudflared` and `libssh2`.
- [ ] Convert SvelteKit routes to a Static SPA structure.

## 6. Development Experience & HMR

- **Frontend HMR**: We will continue using the **Vite Dev Server** during development. It will be configured to proxy API requests (e.g., `/api/*`) to the Zig backend.
- **Backend Watch Mode**: We will use a file watcher (like `watchexec` or a Zig-native tool) to trigger `zig build run` on source changes. Zig's sub-second compilation ensures the backend restarts almost instantly.
- **Unified Workflow**: A `dev.sh` or `Makefile` will be provided to start both environments with a single command.

## 7. Database Migrations

<<<<<<< Current (Your changes)
### Approach Options

**Option A: Hybrid (Recommended for MVP)**
- Keep using Drizzle Kit for migration generation (`drizzle-kit generate`)
- Existing SQL migration files work as-is
- Build Zig migration runner to execute migrations on startup
- **Pros**: Leverages existing tooling, faster to implement
- **Cons**: Requires Node.js for migration generation

**Option B: Full Zig Migration System**
- Build `zig-migrate` CLI tool (see `zig-migrate-proposal.md`)
- Define schemas in Zig using comptime
- Generate migrations from schema diffs
- **Pros**: Fully native, no TypeScript dependency
- **Cons**: More initial development effort

### Migration Execution

Regardless of generation method, migrations will be executed by a Zig runtime module:
- Reads SQL files from `drizzle/` directory
- Tracks applied migrations in `__drizzle_migrations` table
- Executes pending migrations on server startup
- Supports rollback (future enhancement)
=======
### Approach: Hybrid (Option 1) ✅

We're using the **hybrid approach**:

- **Migration Generation**: Continue using Drizzle Kit (`drizzle-kit generate`)
- **Migration Execution**: Zig-based migration runner (see `zig/src/db/migrate.zig`)

### Implementation

The migration system is implemented in `zig/src/db/migrate.zig`:

- Reads SQL files from `drizzle/` directory
- Tracks applied migrations in `__drizzle_migrations` table
- Handles Drizzle's `--> statement-breakpoint` format
- Executes pending migrations on server startup
- Gracefully handles "already exists" errors

### Usage

```zig
// In your server initialization:
var db = try database.openFromEnv(allocator);
try db.initialize("drizzle");  // Automatically runs migrations
```

### Development Workflow

1. Make schema changes in `src/lib/server/db/schema.ts` (TypeScript)
2. Generate migration: `npm run db:generate`
3. Zig server automatically applies migrations on startup

### Benefits

- ✅ Leverages existing Drizzle Kit tooling
- ✅ No need to reimplement migration generation
- ✅ 100% compatible with existing migration files
- ✅ Fast to implement and maintain
- ✅ Can still use `drizzle-kit studio` and other tools
>>>>>>> Incoming (Background Agent changes)
