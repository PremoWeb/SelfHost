# Testing the Zig Server

## Quick Start

1. **Build the server:**
   ```bash
   cd zig
   zig build
   ```

2. **Start the server:**
   ```bash
   PORT=3001 ./zig-out/bin/selfhost-server
   ```

   The server will:
   - Create `sqlite.db` if it doesn't exist
   - Run migrations from the `drizzle/` directory
   - Start listening on port 3001 (or PORT env var)

## Testing Endpoints

### Health Check (No Auth Required)
```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{"status":"ok","timestamp":1234567890}
```

### Get Servers (Requires Auth)
```bash
curl http://localhost:3001/api/servers
```

Expected response (without auth):
```json
{"message":"Unauthorized"}
```

### Create Server (Requires Auth)
```bash
curl -X POST http://localhost:3001/api/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Server",
    "ip": "192.168.1.100",
    "port": 22,
    "user": "root"
  }'
```

## Testing with Authentication

To test with authentication, you'll need:
1. A valid session token from Better Auth
2. Pass it in the `Authorization: Bearer <token>` header

Or use cookies:
```bash
curl -X POST http://localhost:3001/api/servers \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_TOKEN" \
  -d '{"name": "Test", "ip": "1.2.3.4"}'
```

## Troubleshooting

### Server won't start
- Check if port 3001 is already in use: `lsof -i :3001`
- Check logs for database errors
- Verify migrations directory exists: `ls drizzle/*.sql`

### Database errors
- The server creates `sqlite.db` automatically
- Migrations run on startup
- Check that `drizzle/` directory contains SQL migration files

### Authentication errors
- Header extraction is implemented but needs testing with actual Zap API
- Check that session tokens match Better Auth format
