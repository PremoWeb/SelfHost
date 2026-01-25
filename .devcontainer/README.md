# Dev Container Setup

This directory contains the configuration for developing SelfHost in a containerized environment using VS Code Dev Containers.

## Overview

- **Base Image**: `oven/bun:latest` - Official Bun runtime
- **SQLite Persistence**: Named Docker volumes for database files
- **Auto-setup**: Dependencies installed automatically on container creation

## Quick Start

### First Time Setup

1. **Install Prerequisites**:
   - [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - [VS Code](https://code.visualstudio.com/)
   - [Dev Containers Extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

2. **Open in Container**:
   - Open this project in VS Code
   - Press `F1` → "Dev Containers: Reopen in Container"
   - Wait for container to build and dependencies to install

3. **Migrate Existing Databases** (if you have existing SQLite files):

   ```bash
   ./.devcontainer/migrate-sqlite.sh
   ```

4. **Start Development**:
   ```bash
   bun dev
   ```

## Architecture

### Volume Mounts

The dev container uses two named Docker volumes for data persistence:

1. **`selfhost-sqlite-data`** → `/workspace/sqlite-data`
   - Stores all SQLite database files
   - Persists across container rebuilds
   - Symlinked to workspace root for compatibility

2. **`selfhost-git-repos`** → `/workspace/data/git-repos`
   - Stores Git repositories managed by the application
   - Persists across container rebuilds

### Environment Variables

The container automatically sets:

- `DATABASE_URL=file:/workspace/sqlite-data/sqlite.db`
- `LOGGING_DATABASE_URL=file:/workspace/sqlite-data/sqlite-logs.db`

### Installed Extensions

- **Svelte**: Full Svelte 5 support with syntax highlighting
- **TypeScript**: ESLint and Prettier for code quality
- **SQLite Tools**: Database viewer and query runner
- **Tailwind CSS**: IntelliSense for utility classes
- **GitLens**: Enhanced Git integration

## Database Management

### Viewing Databases

Use the SQLTools extension (pre-configured):

1. Click SQLTools icon in sidebar
2. Select "SelfHost Main DB" or "SelfHost Logs DB"
3. Run queries or browse tables

### Backup Databases

```bash
# Backup to host
docker cp $(docker ps -qf "name=selfhost"):/workspace/sqlite-data/sqlite.db ./backup-$(date +%Y%m%d).db
```

### Reset Databases

```bash
# Remove volume (WARNING: deletes all data)
docker volume rm selfhost-sqlite-data

# Rebuild container to recreate volume
# Press F1 → "Dev Containers: Rebuild Container"
```

## Troubleshooting

### Container won't start

- Check Docker Desktop is running
- Try: F1 → "Dev Containers: Rebuild Container Without Cache"

### Dependencies not installing

- Check internet connection
- Manually run: `bun install`

### SQLite file not found

- Run migration script: `./.devcontainer/migrate-sqlite.sh`
- Check symlinks exist: `ls -la *.db`

### Port 5173 already in use

- Stop other dev servers on your host
- Or change port in `vite.config.ts`

## Advanced

### Customizing the Container

Edit `.devcontainer/devcontainer.json` to:

- Add more VS Code extensions
- Install additional system packages
- Change environment variables
- Modify port forwarding

### Accessing Volume Data

```bash
# List volumes
docker volume ls | grep selfhost

# Inspect volume
docker volume inspect selfhost-sqlite-data

# Access volume directly
docker run --rm -v selfhost-sqlite-data:/data alpine ls -la /data
```

## Resources

- [Dev Containers Documentation](https://code.visualstudio.com/docs/devcontainers/containers)
- [Bun Documentation](https://bun.sh/docs)
- [SvelteKit Documentation](https://kit.svelte.dev/)
