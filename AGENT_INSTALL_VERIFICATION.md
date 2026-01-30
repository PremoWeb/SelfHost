# Agent Installation Verification Steps

This document outlines the exact steps taken to manually verify the fixes for the SelfHost Agent installation and connection process.

## 1. Establish a Public Entry Point (Cloudflare Tunnel)

Since the remote server needs to reach the local development machine, we expose the Zig backend using a Cloudflare Tunnel.

```bash
# In a dedicated terminal
cloudflared tunnel --url http://localhost:3000
```

Capture the generated URL (e.g., `https://example.trycloudflare.com`). This is the `callbackUrl` that will be provided to the agent.

## 2. Start the Local Stack

Ensure the full stack is running locally to handle the installation request and subsequent WebSocket connections.

```bash
bun run dev:all
```

## 3. Temporary Authentication Bypass (For Manual Testing)

To test via `curl` without active session cookies, the following temporary changes were made to `zig/src/api.zig`:

- Modified `handleApiRequest` to skip `auth_middleware.requireAuth(&ctx)` if the path ends in `/install-agent`.
- Manually set `ctx.is_god = true` within the bypass block to allow private key lookups.

## 4. Get the Target Server UUID

Retrieve the UUID of the server you wish to test on from the SQLite database.

```bash
sqlite3 sqlite.db "SELECT id FROM servers WHERE name = 'test';"
```

## 5. Trigger Installation via Curl

Simulate the UI's installation request using the captured tunnel URL.

```bash
curl -N -X POST http://localhost:3000/api/servers/<SERVER_UUID>/install-agent \
     -H "Content-Type: application/json" \
     -d '{"callbackUrl": "https://YOUR-TUNNEL-URL.trycloudflare.com"}'
```

## 6. Verification Checklist

### Detach Logic (SSH Hang Fix)

Observe the installation logs in `dev.log` or the `curl` output.

- [x] **Detection**: Init system correctly identified (e.g., systemd or openrc).
- [x] **Completion**: The SSH session closes immediately after "STEP: Done." instead of hanging. This confirms that the fallback `exec </dev/null` redirection is working.

### Connectivity

Check the backend logs for the agent's callback.

- [x] **WebSocket Upgrade**: Log should show `WebSocket upgrade successful for agent: <UUID>`.
- [x] **Hello Message**: Log should show `Agent hello from server <UUID>`.

### Data Flow

Ensure metrics are being received by the connection pool.

- [x] **Health Metrics**: Tailing the logs should show periodic health updates:
  ```bash
  tail -f dev.log | grep "Agent health"
  # Output: debug(agent_ws): Agent health from server <UUID>: CPU=0.00, RAM=39%, Disk=14%
  ```

## Summary of Fixes Applied

1.  **Wrapper Redirection**: Added `exec </dev/null >>/var/log/selfhost-agent.log 2>&1` to `start.sh` to prevent pipe inheritance from blocking SSH.
2.  **OpenRC Native Logging**: Updated service template to use `stdout_log` and `stderr_log`.
3.  **SSH Redirection**: Injected `< /dev/null` into service restart commands in `agent_install.zig`.
4.  **Persistent Settings**: Ensured `WebSocketSettings` are heap-allocated in `api.zig` to prevent segfaults during the async upgrade process.
