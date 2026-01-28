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

## 5. Migration Checklist

- [ ] Initialize `port/zig-svelte` branch.
- [ ] Setup `build.zig` with cross-compilation targets (`arm-linux-musleabihf`).
- [ ] Implement Zap-based HTTP/WS boilerplate.
- [ ] Port Drizzle schema to raw SQL definitions in Zig.
- [ ] Implement SQLite `update_hook` -> WebSocket bridge.
- [ ] Build background worker logic for `cloudflared` and `libssh2`.
- [ ] Convert SvelteKit routes to a Static SPA structure.

## 6. Development Experience & HMR

- **Frontend HMR**: We will continue using the **Vite Dev Server** during development. It will be configured to proxy API requests (e.g., `/api/*`) to the Zig backend.
- **Backend Watch Mode**: We will use a file watcher (like `watchexec` or a Zig-native tool) to trigger `zig build run` on source changes. Zig's sub-second compilation ensures the backend restarts almost instantly.
- **Unified Workflow**: A `dev.sh` or `Makefile` will be provided to start both environments with a single command.
