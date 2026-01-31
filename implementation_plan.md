# Implementation Plan - Name Server Profiles

The "Name Server Profile" feature is present in the frontend UI and database schema but missing from the backend (Zig) and frontend server actions (SvelteKit). This plan outlines the steps to implement the missing functionality.

## 1. Backend (Zig)

### 1.1. Create Service (`zig/src/services/nameserver_profiles.zig`)

Implement CRUD operations for the `nameserver_profiles` table:

- `NameserverProfile` struct (matching DB schema).
- `listByTeam(allocator, db, team_id)`
- `create(allocator, db, data)`
- `delete(allocator, db, id, team_id)`
- `setDefault(allocator, db, team_id, profile_id)` (Update `teams` table)

### 1.2. Update API Handlers (`zig/src/api.zig`)

Add `handleNameserverProfiles` function:

- `GET /api/nameserver-profiles`: List profiles.
- `POST /api/nameserver-profiles`: Create profile.
- `DELETE /api/nameserver-profiles/{id}`: Delete profile.
- `POST /api/nameserver-profiles/{id}/set-default`: Set as default.

### 1.3. Register Routes (`zig/src/api.zig`)

Update `handleApiRequest` to route `/api/nameserver-profiles` requests to the handler.

## 2. Frontend (SvelteKit)

### 2.1. Server Load Function (`frontend/src/routes/(app)/nameservers/+page.server.ts`)

- Fetch profiles from Zig API (`GET /api/nameserver-profiles`).
- Fetch VPS providers (for "DNS API Provider" dropdown).
- Return data to the page.

### 2.2. Server Actions (`frontend/src/routes/(app)/nameservers/+page.server.ts`)

Implement form actions calling the Zig API:

- `create`: Calls `POST /api/nameserver-profiles`.
- `delete`: Calls `DELETE /api/nameserver-profiles/{id}`.
- `setDefault`: Calls `POST /api/nameserver-profiles/{id}/set-default`.

## 3. Verification

- Verify creating a profile works.
- Verify listing profiles works.
- Verify deleting a profile works.
