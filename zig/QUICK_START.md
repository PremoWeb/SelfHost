# Quick Start - Testing the Zig Server

## Prerequisites

1. **Zig 0.12+** installed
   ```bash
   # Check version
   zig version
   ```

2. **SQLite3** development libraries
   ```bash
   # Ubuntu/Debian
   sudo apt install libsqlite3-dev
   
   # macOS
   brew install sqlite3
   ```

3. **Database** - Use existing `sqlite.db` or create new one

## Building the Server

```bash
cd zig
zig build
```

This creates `zig-out/bin/selfhost-server`

## Running the Server

```bash
# Set database path (optional, defaults to sqlite.db in project root)
export DATABASE_URL=file:../sqlite.db

# Set port (optional, defaults to 3000)
export PORT=3000

# Run server
zig build run
```

Or run the binary directly:
```bash
./zig-out/bin/selfhost-server
```

## Testing the API

### 1. Health Check (No Auth Required)

```bash
curl http://localhost:3000/api/health
```

Expected:
```json
{"status":"ok","timestamp":1234567890}
```

### 2. Get Servers (Requires Auth)

```bash
# This will fail with 401 until auth is implemented
curl http://localhost:3000/api/servers
```

### 3. Test with Authentication

For now, you can temporarily disable auth checks or use a test token. The auth system is partially implemented.

## Frontend Setup (Coming Soon)

The frontend will be a Svelte SPA that:
1. Connects to the Zig backend API
2. Uses WebSockets for real-time updates
3. Runs on a separate port (e.g., 5173) during development

### Development Setup (Future)

```bash
# Terminal 1: Run Zig backend
cd zig
zig build run

# Terminal 2: Run Svelte frontend (when ready)
npm run dev
```

The frontend will proxy API requests to `http://localhost:3000`

## Current Status

✅ **Backend API** - Partially implemented
- Health check endpoint
- Servers CRUD endpoints (GET, POST, PATCH, DELETE)
- Companies endpoints (GET)
- Projects endpoints (GET)
- Authentication middleware (needs header extraction implementation)

⚠️ **Frontend** - Not yet set up
- Need to configure Svelte SPA mode
- Need to set up API client to point to Zig backend
- Need to configure WebSocket connection

## Next Steps

1. **Test Backend**: Use curl/Postman to test API endpoints
2. **Set Up Frontend**: Configure Svelte to build as SPA
3. **Connect Frontend**: Point API client to Zig backend
4. **Test Full Stack**: Verify end-to-end functionality
