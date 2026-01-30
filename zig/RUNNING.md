# Running the Zig Server

## Quick Start

The server has been built and is ready to run. Here's how to start it:

### Option 1: Use the Start Script
```bash
cd zig
./START_SERVER.sh
```

### Option 2: Run Directly
```bash
cd zig
PORT=3001 ./zig-out/bin/selfhost-server
```

## Browser Access

Open your browser and go to:

- **Root page:** `http://localhost:3001/` — shows a simple HTML page with links to the API
- **Health check:** `http://localhost:3001/api/health` — returns JSON

The root path (`/`) now serves a simple HTML page so you can confirm the server is running from the browser.

## What to Expect

When the server starts, you should see output like:
```
info: Starting selfhost server...
info: Initializing database...
info: Database initialized successfully
info: Setting up real-time update hooks...
info: Initializing WebSocket connection pool...
info: Starting HTTP/WebSocket server on port 3001...
info: Server listening on http://localhost:3001
```

## Testing Endpoints

Open a **new terminal** and run these tests:

### 1. Health Check (No Auth Required)
```bash
curl http://localhost:3001/api/health
```

**Expected Response:**
```json
{"status":"ok","timestamp":1234567890}
```

### 2. Get Servers (Requires Auth)
```bash
curl http://localhost:3001/api/servers
```

**Expected Response (without auth):**
```json
{"message":"Unauthorized"}
```

### 3. Create Server (Requires Auth)
```bash
curl -X POST http://localhost:3001/api/servers \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Server","ip":"192.168.1.100"}'
```

**Expected Response (without auth):**
```json
{"message":"Unauthorized"}
```

### 4. Get Companies
```bash
curl http://localhost:3001/api/companies
```

### 5. Get Projects
```bash
curl http://localhost:3001/api/projects
```

## Troubleshooting

### Server Won't Start
- Check if port 3001 is in use: `lsof -i :3001` or `netstat -tlnp | grep 3001`
- Check for errors in the console output
- Verify the binary exists: `ls -lh zig-out/bin/selfhost-server`

### Database Issues
- The server creates `sqlite.db` automatically
- Migrations run on startup from the `drizzle/` directory
- Check if `sqlite.db` was created: `ls -lh sqlite.db`

### Connection Refused
- Make sure the server is actually running
- Check the port number matches (default is 3001)
- Try a different port: `PORT=3002 ./zig-out/bin/selfhost-server`

## What's Implemented

✅ **Build System** - Compiles successfully
✅ **Database Layer** - SQLite with migrations
✅ **Health Endpoint** - `/api/health` (no auth)
✅ **Server Endpoints** - GET, POST, PATCH, DELETE `/api/servers`
✅ **Company Endpoints** - GET `/api/companies`
✅ **Project Endpoints** - GET `/api/projects`
✅ **Authentication Middleware** - Header extraction implemented
✅ **Error Handling** - Proper HTTP status codes

## Next Steps

1. **Test Authentication** - Verify header extraction works with actual tokens
2. **Test Database Operations** - Create servers and verify they're stored
3. **Test WebSockets** - If real-time features are needed
4. **Add More Endpoints** - Complete POST endpoints for companies/projects

## Files Created

- `zig/START_SERVER.sh` - Convenient start script
- `zig/TESTING.md` - Detailed testing guide
- `zig/TEST_RESULTS.md` - Test results template
- `zig/RUNNING.md` - This file
