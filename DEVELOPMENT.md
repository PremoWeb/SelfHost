# SelfHost Development Guide

## 🎯 Overview

This guide will help you get started with developing for the SelfHost platform, which consists of a **SvelteKit Frontend** and a **Zig Backend**.

## 📋 Prerequisites Checklist

- [ ] Bun 1.1+ installed (`bun --version`)
- [ ] Zig 0.13.0 installed (`zig version`)
- [ ] Docker and Docker Compose installed
- [ ] Git repository cloned
- [ ] Familiarity with Svelte 5 (Runes API)

## 🚨 Rules

- **ALWAYS** use `bun` instead of `node` or `npm`.
- **Backend Logic** belongs in `zig/`.
- **Frontend Logic** belongs in `frontend/`.

## 🚦 Getting Started

### 1. Initial Setup

```bash
# Navigate to the project directory
cd selfhost

# Install dependencies (installs for root and frontend)
bun install

# Copy environment file
cp .env.example .env
```

### 2. Start Development Environment

**Option A: Full Stack (Recommended)**

This starts both the Zig backend (listening on port 3000) and the Vite dev server (port 5173).

```bash
bun run dev:all
# Internally runs:
# - Zig Backend (with Zap): :3000
# - SvelteKit Dev Server: :5173
```

**Option B: Separate Terminals**

You can run them separately to view logs more clearly.

_Terminal 1 (Backend):_

```bash
bun run dev:zig
```

_Terminal 2 (Frontend):_

```bash
bun run dev
```

### 3. Access Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## 🏗️ Architecture Overview

SelfHost uses a decoupled architecture:

```
┌─────────────────────┐      ws/http      ┌─────────────────────┐
│    SvelteKit SPA    │ <-------------->  │     Zig Backend     │
│   (Browser/Client)  │                   │    (Zap Server)     │
└──────────┬──────────┘                   └──────────┬──────────┘
           │                                         │
           │                                         │ Native SQLite (C)
           │                                         ↓
           │                              ┌─────────────────────┐
           │                              │   SQLite Database   │
           └───────────────────────────── │    (sqlite.db)      │
                                          └─────────────────────┘
```

## 📁 Key Directories

### Root Level

- `frontend/` - SvelteKit source code
- `zig/` - Zig source code
- `agent/` - Agent source code

### `frontend/src/`

- **`routes/`** - SvelteKit pages (SPA mode). Note: `+page.server.ts` is NOT used. Use `+page.ts` for client-side loading from the Zig API.
- **`lib/api/`** - TypeScript client for the Zig API.
- **`lib/components/`** - Reusable UI components.

### `zig/src/`

- **`main.zig`** - Entry point.
- **`api.zig`** - HTTP API route handlers.
- **`ws_handler.zig`** - WebSocket logic for the Agent and UI.
- **`db/`** - Database operations using `sqlite`.

## 🔧 Common Development Tasks

### Creating a New Page

1. Create the route in `frontend/src/routes/`.
2. Use `+page.svelte` for the UI.
3. Use `+page.ts` to fetch data from the Zig API.

**frontend/src/routes/projects/+page.ts:**

```typescript
import { api } from '$lib/api/client';

export const load = async () => {
    const response = await api.get('/api/projects');
    return {
        projects: response.data
    };
};
```

### Adding an API Endpoint

1. Modify `zig/src/api.zig`.
2. Add a new route handler in the `routes` definition.
3. Implement the handler function.

```zig
// zig/src/api.zig

fn handleProjects(r: zap.Request) void {
    if (r.methodAsEnum() == .GET) {
        // Fetch from DB and return JSON
        r.sendJson(projects);
    }
}
```

## 🐛 Debugging

### Frontend

- Use Chrome/Firefox DevTools.
- Network tab will show requests to `/api/*` (proxied to Zig backend).

### Backend (Zig)

- Use `std.log.info("My message: {s}", .{variable});` for logging.
- If the server crashes (segfault), check your pointers and memory allocation!

## 📦 Building for Production

```bash
bun run build
# This builds the frontend (SPA) and compiles the Zig binary.
# The resulting artifacts are production-ready.
```
