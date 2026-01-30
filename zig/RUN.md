# Running the Zig Server

## Quick Start

```bash
# 1. Navigate to zig directory
cd zig

# 2. Build the server
zig build

# 3. Set database path (optional, defaults to sqlite.db in project root)
export DATABASE_URL=file:../sqlite.db

# 4. Set port (optional, defaults to 3000)
export PORT=3000

# 5. Run the server
zig build run
```

## What Happens on Startup

1. ✅ Opens SQLite database (from `DATABASE_URL` or `sqlite.db`)
2. ✅ Runs pending migrations from `../drizzle/` directory
3. ✅ Sets up SQLite update hooks for real-time notifications
4. ✅ Initializes WebSocket connection pool
5. ✅ Starts HTTP server on port 3000
6. ✅ Starts WebSocket server on `/ws`

## Testing

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Test Script
```bash
./test_api.sh
```

### With Frontend

1. **Terminal 1**: Start Zig backend
   ```bash
   cd zig
   export DATABASE_URL=file:../sqlite.db
   zig build run
   ```

2. **Terminal 2**: Start Svelte frontend with proxy
   ```bash
   export ZIG_BACKEND=true
   npm run dev
   ```

The frontend will proxy all `/api/*` requests to `http://localhost:3000`.

## Troubleshooting

### Port Already in Use
```bash
# Use a different port
export PORT=3001
zig build run
```

### Database Not Found
```bash
# Specify database path
export DATABASE_URL=file:/path/to/sqlite.db
zig build run
```

### Migration Errors
- Check that `drizzle/` directory exists
- Verify migration files are valid SQL
- Check database permissions

## Environment Variables

- `DATABASE_URL` - SQLite database path (default: `sqlite.db`)
- `PORT` - HTTP server port (default: `3000`)
