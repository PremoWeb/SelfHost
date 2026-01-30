# Zig Server Setup Guide

## Prerequisites

1. **Zig 0.12+** installed
2. **SQLite3** development libraries
3. **Zap dependency** - needs to be added via `zig fetch`

## Initial Setup

### 1. Fetch Dependencies

```bash
cd zig
zig fetch
```

This will download Zap and update `build.zig.zon` with the correct hash.

### 2. Build

```bash
zig build
```

This will compile the server for your current platform.

### 3. Cross-compilation

The build system supports cross-compilation for:
- **x86_64-linux**: `zig build -Dtarget=x86_64-linux-gnu`
- **aarch64-linux**: `zig build -Dtarget=aarch64-linux-gnu`
- **armv6-linux** (Raspberry Pi Zero W): `zig build -Dtarget=arm-linux-musleabihf`

All targets are configured in `build.zig` and will be built when you run `zig build`.

## Running

### Development

```bash
# Set database path (optional, defaults to sqlite.db)
export DATABASE_URL=file:sqlite.db

# Set port (optional, defaults to 3000)
export PORT=3000

# Run server
zig build run
```

The server will:
1. Open the database
2. Run pending migrations from `../drizzle/` directory
3. Start HTTP server on port 3000 (or PORT env var)
4. Start WebSocket server on `/ws`

## API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Servers
- `GET /api/servers` - List servers
- `POST /api/servers` - Create server
- `GET /api/servers/{uuid}` - Get server by ID
- `PATCH /api/servers/{uuid}` - Update server
- `DELETE /api/servers/{uuid}` - Delete server

### Companies
- `GET /api/companies` - List companies
- `POST /api/companies` - Create company

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project

## WebSocket

- `WS /ws` - WebSocket endpoint for real-time updates

## Next Steps

1. **Implement database queries** - Replace TODO comments in `api.zig` with actual SQLite queries
2. **Add authentication** - Implement session/auth middleware
3. **SQLite update hooks** - Set up real-time notifications via `sqlite3_update_hook()`
4. **WebSocket broadcast** - Implement connection pool and broadcast system
5. **Error handling** - Add proper error responses
6. **Request validation** - Validate request bodies and parameters
7. **Static file serving** - Serve Svelte SPA build output

## Troubleshooting

### Zap dependency issues

If you get errors about Zap, you may need to:
1. Check that `zig fetch` completed successfully
2. Verify the Zap URL in `build.zig.zon` is correct
3. Check Zap's documentation for the correct module path

### SQLite not found

Install SQLite development libraries:
- **Ubuntu/Debian**: `sudo apt-get install libsqlite3-dev`
- **Arch**: `sudo pacman -S sqlite`
- **macOS**: `brew install sqlite`

### Port already in use

Change the port:
```bash
export PORT=3001
zig build run
```
