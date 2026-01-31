# Git Hosting Feature - Porting Progress

## Overview

Porting Git repository hosting features from SvelteKit/TypeScript to Zig backend with Svelte frontend.

## Backend (Zig) - ✅ Core Infrastructure Complete

### Completed

1. **Git Service Module** (`zig/src/services/git.zig`)
   - ✅ GitRepository struct with full field mapping
   - ✅ SshKey struct
   - ✅ Repository creation and initialization
   - ✅ Repository queries (by ID, by project ID)
   - ✅ SSH key management (add, list, delete)
   - ✅ SSH fingerprint calculation (SHA256)
   - ✅ Helper functions (UUID generation, bool/int parsing)

2. **API Handlers** (`zig/src/git_handlers.zig`)
   - ✅ POST /api/git/repositories - Create repository
   - ✅ GET /api/git/repositories - List repositories (stub)
   - ✅ GET /api/ssh/keys - List user's SSH keys
   - ✅ POST /api/ssh/keys - Add SSH key
   - ✅ DELETE /api/ssh/keys/:id - Delete SSH key
   - ⏳ GET/PATCH/DELETE /api/git/repositories/:id - Repository management (stub)

3. **JSON Serialization** (`zig/src/json.zig`)
   - ✅ serializeGitRepository() - Full repository JSON
   - ✅ serializeSshKey() - SSH key JSON (excludes full public key)
   - ✅ serializeSshKeyArray() - Array wrapper

4. **API Routing** (`zig/src/api.zig`)
   - ✅ Git routes registered
   - ✅ SSH key routes registered
   - ✅ Authentication middleware integrated

### TODO - Backend

- [ ] Git Smart HTTP Protocol handlers
  - [ ] GET /api/git/:projectId/:repoName/info/refs
  - [ ] POST /api/git/:projectId/:repoName/git-upload-pack (clone/pull)
  - [ ] POST /api/git/:projectId/:repoName/git-receive-pack (push)
- [ ] Repository access control
  - [ ] hasRepositoryAccess() implementation
  - [ ] Repository collaborators management
- [ ] Repository statistics updates
  - [ ] Post-push hook to update commit counts, branches, etc.
- [ ] SSH authorization endpoint for gitpremo-shell
  - [ ] GET /api/ssh/authorize - Validate SSH keys for git operations
- [ ] Repository namespace resolution
  - [ ] getRepositoryByNamespace() - Map team/user slugs to repos

## Frontend (Svelte) - 🚧 In Progress

### Planned Components

#### 1. Repository Management UI

**Location**: `frontend/src/routes/(app)/projects/[uuid]/repository/`

Components needed:

- `+page.svelte` - Main repository view
  - Repository overview (commits, branches, size)
  - Clone URLs (HTTP/SSH)
  - Repository settings
  - File browser (future enhancement)
- `+page.ts` - Load repository data

  ```typescript
  export async function load({ params, fetch }) {
    const repo = await fetch(`/api/git/repositories?projectId=${params.uuid}`);
    return { repository: await repo.json() };
  }
  ```

- Components:
  - `RepositoryHeader.svelte` - Name, description, stats
  - `CloneInstructions.svelte` - HTTP/SSH clone commands
  - `RepositorySettings.svelte` - Privacy, push settings
  - `CreateRepositoryDialog.svelte` - Modal for creating new repo

#### 2. SSH Keys Management UI

**Location**: `frontend/src/routes/(app)/settings/ssh-keys/`

Components needed:

- `+page.svelte` - SSH keys list and management
  - List all user SSH keys
  - Add new SSH key form
  - Delete key confirmation
- `SshKeyCard.svelte` - Individual key display
  - Title, fingerprint, key type
  - Last used timestamp
  - Delete button

- `AddSshKeyDialog.svelte` - Modal for adding keys
  - Title input
  - Public key textarea
  - Validation and submission

#### 3. Integration Points

**Project Page Enhancement**:

- Add "Repository" tab to project navigation
- Show repository status (initialized/not initialized)
- Quick clone button

**Navigation**:

- Add SSH Keys to user settings menu
- Repository link in project sidebar

### API Client Functions

**Location**: `frontend/src/lib/api/git.ts`

```typescript
export async function createRepository(projectId: string, data: {
  name: string;
  description?: string;
  isPrivate?: boolean;
}) {
  const response = await fetch('/api/git/repositories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, ...data })
  });
  return response.json();
}

export async function getProjectRepository(projectId: string) {
  const response = await fetch(`/api/git/repositories?projectId=${projectId}`);
  return response.json();
}

export async function getUserSshKeys() {
  const response = await fetch('/api/ssh/keys');
  return response.json();
}

export async function addSshKey(data: {
  title: string;
  publicKey: string;
}) {
  const response = await fetch('/api/ssh/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
}

export async function deleteSshKey(keyId: string) {
  const response = await fetch(`/api/ssh/keys/${keyId}`, {
    method: 'DELETE'
  });
  return response.json();
}
```

## Database Schema - ✅ Already Exists

The database tables are already defined in the SvelteKit schema:

- `git_repositories` - Repository metadata
- `ssh_keys` - User SSH keys
- `repository_collaborators` - Access control

These tables should already exist from previous migrations.

## Git Smart HTTP Protocol - 📋 Planned

The Git Smart HTTP protocol requires:

1. **Advertise refs**: Return available refs for clone/pull
2. **Upload pack**: Send objects to client (clone/pull)
3. **Receive pack**: Receive objects from client (push)

Implementation will use `std.process.Child` to spawn git commands:

- `git upload-pack --stateless-rpc --advertise-refs`
- `git upload-pack --stateless-rpc`
- `git receive-pack --stateless-rpc`

## SSH Git Access - 🔧 Server Configuration Required

SSH access requires server-side setup (already documented in GIT_SETUP.md):

1. Create `git` system user
2. Install gitpremo scripts
3. Configure sshd with AuthorizedKeysCommand
4. Implement `/api/ssh/authorize` endpoint

## Testing Checklist

### Backend API Tests

- [ ] Create repository via API
- [ ] List repositories (empty and with data)
- [ ] Add SSH key
- [ ] List SSH keys
- [ ] Delete SSH key
- [ ] Validate SSH fingerprint calculation
- [ ] Test authentication requirements

### Frontend Tests

- [ ] Create repository from UI
- [ ] View repository details
- [ ] Copy clone URLs
- [ ] Add SSH key from UI
- [ ] Delete SSH key from UI
- [ ] Form validation

### Integration Tests

- [ ] Clone repository via HTTP
- [ ] Push to repository via HTTP
- [ ] Clone repository via SSH (requires server setup)
- [ ] Push to repository via SSH (requires server setup)

## Next Steps

1. **Frontend UI** (Current Priority)
   - Create SSH keys management page
   - Create repository view page
   - Add repository creation dialog
   - Integrate with project pages

2. **Git HTTP Protocol**
   - Implement info/refs endpoint
   - Implement upload-pack endpoint
   - Implement receive-pack endpoint

3. **Access Control**
   - Implement repository permissions checking
   - Add collaborator management UI

4. **SSH Authorization**
   - Implement /api/ssh/authorize endpoint
   - Test with gitpremo-shell script

## Notes

- **createRepositoryRemote**: Not implemented yet (as noted by user)
- The Zig backend uses direct git command execution via `std.process.Child`
- Repository paths follow pattern: `data/git-repos/{projectId}/{repoName}.git`
- SSH keys use SHA256 fingerprints for uniqueness
- All API endpoints require authentication except public repository reads
