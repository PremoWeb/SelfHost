# Getting Started - Testing the Zig Server

## Quick Test (No Frontend Needed)

### 1. Build and Run the Server

```bash
cd zig

# Build
zig build

# Run (uses sqlite.db from project root)
export DATABASE_URL=file:../sqlite.db
zig build run
```

The server will start on `http://localhost:3000`

### 2. Test with curl

```bash
# Health check (no auth required)
curl http://localhost:3000/api/health

# Or use the test script
./test_api.sh
```

### 3. Test with Browser

Open `http://localhost:3000/api/health` in your browser - you should see:
```json
{"status":"ok","timestamp":1234567890}
```

## Connecting the Frontend

### Option 1: Proxy API Requests (Recommended for Development)

Update `vite.config.ts` to proxy API requests to the Zig backend:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
    '/ws': {
      target: 'ws://localhost:3000',
      ws: true,
    }
  }
}
```

Then:
1. **Terminal 1**: Run Zig backend
   ```bash
   cd zig
   export DATABASE_URL=file:../sqlite.db
   zig build run
   ```

2. **Terminal 2**: Run Svelte frontend
   ```bash
   npm run dev
   ```

The frontend on `http://localhost:5173` will proxy all `/api/*` requests to the Zig backend on `http://localhost:3000`.

### Option 2: Update API Client Base URL

Update `src/lib/api/client.ts`:

```typescript
this.client = axios.create({
  baseURL: import.meta.env.DEV 
    ? 'http://localhost:3000/api'  // Zig backend in dev
    : '/api',                        // Same origin in prod
  // ... rest of config
});
```

## Current Limitations

⚠️ **Authentication**: The auth system is partially implemented. Most endpoints will return 401 until:
1. Header extraction is implemented in `auth/middleware.zig`
2. You have a valid session token

**Workaround for Testing**: You can temporarily comment out the `requireAuth` check in `api.zig` to test endpoints without auth.

## Next Steps

1. ✅ **Test Backend**: Use curl/Postman to verify API works
2. ⏳ **Set Up Frontend Proxy**: Configure Vite to proxy to Zig backend
3. ⏳ **Test Full Stack**: Verify frontend can communicate with backend
4. ⏳ **Implement Auth**: Complete authentication flow
