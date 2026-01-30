# Missing Pages & Routes Checklist

The following is a list of pages and routes found in the old SvelteKit source (`src/routes`) that appear to be missing or require porting to the new Zig + Svelte SPA system (`frontend/src/routes`).

> [!NOTE]
> The `frontend` directory is now a SPA. Backend logic from `src/routes/api` must be ported to Zig (Zap/HTTP), while UI pages should move to `frontend/src/routes`.

## 🔴 Critical Infrastructure (Backend Routes)

These routes handle core Git and Webhook functionality and are missing from the new system. They must be implemented in **Zig**.

- [ ] **Git Smart HTTP Backend** (`src/routes/[namespace]`)
  - [ ] `[repoName].git` (Git clone/push handling) -- _This is critical for `git clone` support_
- [ ] **Webhooks** (`src/routes/webhooks`)
  - [ ] GitHub App Webhook listeners
  - [ ] Stripe/Payment webhooks (if applicable)

## 🟠 Backend API Endpoints (`src/routes/api`)

The entire `api` directory (67 sub-routes) is missing. These provided the backend logic for the frontend. They need to be reimplemented as **Zig API endpoints**.

### Authentication & Users

- [x] `api/auth` (Login, Logout, Session with team) — **Zig**: `/api/auth/login`, `/api/auth/logout`, `/api/auth/session`, `/api/auth/session/team`
- [ ] `api/auth/register` (Register) — not yet in Zig
- [ ] `api/user` (Profile management)
- [x] `api/teams` (List teams for current user) — **Zig**: GET `/api/teams` (via team_members)

### Core Resources

- [x] `api/projects` (List, get by id) — **Zig**: GET `/api/projects`, GET `/api/projects/:uuid`
- [x] `api/servers` (CRUD) — **Zig**: GET/POST `/api/servers`, GET/PATCH/DELETE `/api/servers/:uuid`
- [ ] `api/deployments` (Deployment triggers/status)
- [ ] `api/domains` (Domain management)
- [ ] `api/cloud-providers` (AWS/Hetzner integration)

### Infrastructure

- [ ] `api/ssh-keys` (Public key management)
- [ ] `api/destinations` (Docker/VPS targets)
- [ ] `api/variables` (Environment variables)

### Monitoring & Logs

- [ ] `api/logs` (Action logs, build logs)
- [ ] `api/stats` (Server statistics)

## 🟡 Frontend Application Pages (`src/routes/(app)`)

The folder structure exists in `frontend/src/routes/(app)`, but we must verify the **logic** has been ported. Since `+page.server.ts` files (Server-Side Data Loading) don't work in a SPA, they must be converted to client-side API calls (`+page.ts` / `onMount`).

- [x] **(app) layout** — Loads session from Zig `GET /api/auth/session` (user + team); auth store updated client-side.
- [ ] **Dashboard** (`/`) - Verify data fetching calls API.
- [ ] **Project Views** (`/projects`) - Verify list and detail views.
- [ ] **Settings Pages** (`/settings`)
  - [ ] General
  - [ ] Members
  - [ ] Billing
- [ ] **Terminal** (`/terminal`) - Verify WebSocket connection to Zig.

## 🟢 Public Pages

- [ ] `(public)` - Layouts seem simple, verify static asset loading only.

---

## Action Plan

1.  **Prioritize `[namespace]` implementation** in Zig to support basic Git operations.
2.  **Map `src/routes/api` endpoints** to Zig HTTP handlers (Zap).
3.  **Refactor Frontend Loaders**: Convert `+page.server.ts` `load()` functions to use the new `api.ts` client in `+page.ts` or `+page.svelte`.
