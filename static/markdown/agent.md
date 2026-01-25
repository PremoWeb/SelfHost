---
title: SelfHost Agent
description: Understanding the SelfHost Agent architecture and why we use it instead of SSH
---

# SelfHost Agent

The SelfHost Agent is a lightweight, Bun-based service that runs on your servers and maintains a persistent WebSocket connection to your SelfHost control panel. This document explains what the agent is, how it works, and why we chose this architecture over traditional SSH-based management.

## What is the SelfHost Agent?

The SelfHost Agent is a small TypeScript application (~400 lines) that:

- **Maintains a persistent connection** to your SelfHost control panel via WebSocket
- **Executes commands** remotely with real-time output streaming
- **Reports health metrics** (CPU, memory, disk usage) every 5 seconds
- **Handles file operations** (read, write, append) securely
- **Manages service restarts** and system reboots
- **Supports WireGuard** tunnel management
- **Auto-reconnects** on connection loss

## Architecture Overview

The SelfHost Agent architecture uses a hybrid approach: **SSH for initial setup** (one-time only) and **WebSocket for ongoing operations**.

```agent-architecture
AGENT_ARCH_DIAGRAM
```

### Architecture Flow

**Phase 1: Initial Setup (SSH Required - One-Time Only)**
1. Control panel connects to server via SSH using provided credentials
2. Detects system architecture (x86_64, ARM, etc.) and init system (systemd/OpenRC)
3. Installs Bun runtime if not already present
4. Uploads agent source code to `/var/lib/selfhost/agent.ts`
5. Creates and configures systemd or OpenRC service
6. Starts the agent service
7. Agent immediately establishes WebSocket connection to control panel

**Phase 2: Ongoing Operations (No SSH Required)**
1. Agent maintains persistent WebSocket connection (outbound from server)
2. Control panel sends commands through WebSocket connection
3. Agent executes commands and streams output back in real-time
4. Agent reports health metrics (CPU, memory, disk) every 5 seconds
5. All future operations use WebSocket - SSH credentials can be removed

**Key Point:** SSH is only used for the initial one-time installation. Once the agent is running, all communication happens via WebSocket, and SSH is no longer needed.

### Key Components

1. **Agent Service** (`/var/lib/selfhost/agent.ts`)
   - Runs as a systemd or OpenRC service
   - Maintains persistent WebSocket connection to control panel
   - Handles incoming commands and reports status
   - Auto-reconnects on connection loss

2. **Control Panel** (`src/lib/server/agent/manager.ts`)
   - Manages agent connections and routing
   - Handles initial SSH-based installation (one-time)
   - Routes commands to appropriate agents via WebSocket
   - Tracks agent health and status

3. **WebSocket Endpoint** (`src/routes/api/agent/+server.ts`)
   - Accepts outbound agent connections (no inbound ports needed)
   - Authenticates agents via agent ID and key
   - Streams commands and receives responses
   - Enables real-time bidirectional communication

## Why Agent Instead of SSH?

While SelfHost supports both SSH and agent-based connections, the agent architecture provides several significant advantages:

### 1. **Outbound Connections (No Inbound Ports Required)**

**SSH Approach:**
- Requires port 22 (or custom port) to be open and accessible
- Needs firewall rules to allow inbound connections
- Vulnerable to port scanning and brute force attacks
- Requires public IP or port forwarding

**Agent Approach:**
- Makes **outbound** WebSocket connections to your control panel
- No inbound ports need to be opened on your server
- Works behind NAT, firewalls, and corporate networks
- Only the control panel needs to be publicly accessible

### 2. **Persistent Connection & Real-Time Monitoring**

**SSH Approach:**
- Each operation requires establishing a new SSH connection
- Connection overhead for every command
- No persistent monitoring without keeping SSH sessions open
- Difficult to track server health in real-time

**Agent Approach:**
- Single persistent WebSocket connection
- Real-time health metrics every 5 seconds
- Instant command execution without connection overhead
- Continuous monitoring of CPU, memory, disk, and proxy status

### 3. **Automatic Reconnection**

**SSH Approach:**
- If connection drops, you must manually reconnect
- No automatic recovery from network issues
- Requires manual intervention for temporary outages

**Agent Approach:**
- Automatically reconnects on connection loss (5-second retry)
- Handles temporary network outages gracefully
- Maintains service availability even during network issues

### 4. **Enhanced Security**

**SSH Approach:**
- Requires storing SSH private keys in the control panel
- Keys must be rotated manually
- Risk of key compromise affecting all servers
- SSH keys grant full system access

**Agent Approach:**
- Uses unique agent keys per server (32-byte random)
- Keys can be rotated without affecting server access
- Agent runs with limited permissions (configurable)
- No long-lived SSH credentials stored

### 5. **Better Firewall & Network Compatibility**

**SSH Approach:**
- May be blocked by corporate firewalls
- Requires VPN or port forwarding in many environments
- Difficult to use with dynamic IPs

**Agent Approach:**
- Works through most firewalls (outbound HTTPS/WSS)
- Compatible with corporate networks
- Works with dynamic IPs (agent initiates connection)
- **SSH over Tunnels**: Supports initial installation via Cloudflare Tunnels, eliminating the need to expose port 22.
- Can use tunnels (WireGuard) for additional security

### 6. **Real-Time Command Execution**

**SSH Approach:**
- Command output only available after completion
- Difficult to stream long-running command output
- No real-time feedback during execution

**Agent Approach:**
- Streams command output in real-time
- Supports long-running commands with live updates
- Better UX for deployment and monitoring operations

### 7. **Service Management**

**SSH Approach:**
- Must manually check if services are running
- No automatic service recovery
- Difficult to manage service lifecycle remotely

**Agent Approach:**
- Monitors service status (e.g., Traefik proxy)
- Can restart services automatically
- Integrated with systemd/OpenRC for reliable service management

## Deployment Process

The agent is currently deployed using a **one-time SSH connection** during initial setup. We are investigating cloud-init and install script options that would eliminate the need for SSH entirely, even for initial setup.

### Current Deployment Methods
 
- **Direct SSH**: Connect via public IP and port 22.
- **SSH over Cloudflare Tunnel**: Use `cloudflared` to proxy the initial connection through Cloudflare Access, perfect for hidden servers.
- **Agent Update**: Once installed, the agent can be updated automatically over the WebSocket connection.
- 
### Current Deployment (SSH-based)

1. **Initial SSH Connection** (one-time only)
   - Control panel connects via SSH using your provided credentials
   - Detects system architecture and init system (systemd/OpenRC)
   - Installs Bun runtime if needed
   - Uploads agent source code to `/var/lib/selfhost/agent.ts`

2. **Service Installation**
   - Creates systemd service (`/etc/systemd/system/selfhost-agent.service`) or
   - Creates OpenRC init script (`/etc/init.d/selfhost-agent`)
   - Configures auto-restart on failure
   - Sets environment variables (server URL, agent ID, agent key)

3. **Service Activation**
   - Starts the agent service
   - Agent immediately connects to control panel via WebSocket
   - After successful connection, SSH is no longer required

4. **Ongoing Operation**
   - Agent maintains persistent WebSocket connection
   - All future operations use the agent (no SSH needed)
   - Agent auto-updates can be pushed through the WebSocket connection

### Future Deployment Options (Under Investigation)

We are exploring alternative deployment methods that would eliminate the SSH requirement entirely:

- **Cloud-init Integration**: Pre-configure servers with cloud-init scripts that automatically install and configure the agent during server provisioning
- **Install Scripts**: Provide standalone installation scripts that can be run manually or via automation tools, allowing the agent to bootstrap itself and connect to the control panel
- **Container Images**: Pre-built container images with the agent pre-installed for containerized environments

These options would enable true zero-touch deployment where servers automatically register with your SelfHost control panel upon first boot, without any manual SSH intervention.

## Agent Capabilities

The agent supports the following operations:

### Command Execution
```json
{
  "type": "execute",
  "id": "cmd-123",
  "payload": {
    "command": "docker ps"
  }
}
```

### File Operations
```json
{
  "type": "write_file",
  "id": "file-123",
  "payload": {
    "path": "/data/apps/myapp/server.ts",
    "content": "...",
    "append": false
  }
}
```

### Service Management
- Restart agent: `{"type": "restart"}`
- Reboot server: `{"type": "reboot", "payload": {"type": "graceful"}}`
- Update service URL: `{"type": "update_url", "payload": {...}}`

### Health Reporting
Automatically sends every 5 seconds:
- CPU load average
- Memory usage percentage
- Disk usage percentage
- System uptime
- Proxy status (Traefik)

## Security Considerations

### Agent Authentication
- Each agent has a unique **Agent ID** (server identifier)
- Each agent has a unique **Agent Key** (32-byte random hex)
- Keys are generated server-side and never transmitted over SSH
- WebSocket connections are authenticated via headers

### Command Signing (Future)
- Commands can be signed with HMAC-SHA256
- Prevents command injection or replay attacks
- Timestamp validation prevents stale commands

### Network Security
- WebSocket connections can use WSS (TLS)
- Supports WireGuard tunnels for additional encryption
- Agent keys can be rotated without service interruption

## Troubleshooting

### Agent Not Connecting

1. **Check service status:**
   ```bash
   systemctl status selfhost-agent
   # or
   rc-service selfhost-agent status
   ```

2. **Check logs:**
   ```bash
   journalctl -u selfhost-agent -f
   # or
   tail -f /var/log/selfhost-agent.log
   ```

3. **Verify network connectivity:**
   ```bash
   curl -I https://your-control-panel.com
   ```

4. **Check firewall rules:**
   - Ensure outbound HTTPS (443) is allowed
   - Ensure outbound WSS (WebSocket Secure) is allowed

### Agent Disconnecting Frequently

- Check server network stability
- Verify control panel is accessible
- Review agent logs for error messages
- Ensure system resources (CPU/memory) are adequate

## Migration from SSH to Agent

If you're currently using SSH-based management:

1. Navigate to your server in the SelfHost dashboard
2. Click "Install Agent" button
3. The system will use your existing SSH credentials for one-time setup
4. After installation, the agent takes over all operations
5. SSH credentials can be removed (optional, for security)

## Conclusion

The SelfHost Agent provides a modern, secure, and efficient alternative to traditional SSH-based server management. By using outbound connections, persistent monitoring, and real-time command execution, it offers superior functionality while maintaining better security and network compatibility.

## Technical Installation Details

The following sections detail the exact steps, permissions, and configurations used by the SelfHost Agent installer.

### Connection & Detection

The installer connects via SSH using the server's configured credentials (one-time only).

**Architecture Detection:**
```bash
uname -m && (ls /run/systemd/system > /dev/null 2>&1 && echo systemd || (ls /sbin/openrc > /dev/null 2>&1 && echo openrc || echo generic))
```

- **Purpose**: Detects CPU architecture and Init System (Systemd vs OpenRC).
- **Result**: Stores `initSystem` variable.

**Privilege Detection:**
```bash
whoami && command -v sudo >/dev/null 2>&1 && echo "has_sudo" || echo "no_sudo"
```

- **Purpose**: Checks if connected user is `root` or a standard user with `sudo` access.
- **Result**: Sets variable `s` to `"sudo "` if not root, otherwise empty string `""`.

### File Upload

- **Source**: Local `agent/src/index.ts` (Read as verification-safe Buffer).
- **Destination**: `/tmp/selfhost-agent.ts` (Temporary location).
- **Final**: Moved to `/var/lib/selfhost/agent.ts`.
- **Permissions**: `chmod +x /var/lib/selfhost/agent.ts`.

### Initial Setup

The following commands are executed (with `sudo` if needed):

1. Install dependencies: `apk add curl bash unzip` (OpenRC only).
2. Install Bun: `curl -fsSL https://bun.sh/install | bash` (only if missing).
3. Create directory: `mkdir -p /var/lib/selfhost`.
4. Move file: `mv /tmp/selfhost-agent.ts /var/lib/selfhost/agent.ts`.

### Service Configuration

The installer generates a service file based on the detected Init System.

#### Systemd Service

Used when `/run/systemd/system` exists.

**File**: `/etc/systemd/system/selfhost-agent.service`

```ini
[Unit]
Description=SelfHost Agent
After=network.target

[Service]
Type=simple
Environment=SELFHOST_SERVER_URL=ws://...
Environment=SELFHOST_AGENT_ID=...
Environment=SELFHOST_AGENT_KEY=...
ExecStart=/path/to/bun run /var/lib/selfhost/agent.ts
Restart=always
RestartSec=1

[Install]
WantedBy=multi-user.target
```

**Restart Logic:**
1. Agent receives restart command.
2. Agent exits with **Code 1** (Error).
3. Systemd sees non-zero exit and triggers `Restart=always` policy after 1 second.

#### OpenRC Service

Used when `/sbin/openrc` exists. The installer checks if the modern `supervise-daemon` utility is available.

**Modern OpenRC (with `supervise-daemon`):**

**File**: `/etc/init.d/selfhost-agent`

```sh
#!/sbin/openrc-run
description="SelfHost Agent"
supervisor="supervise-daemon"
command="/path/to/bun"
command_args="run /var/lib/selfhost/agent.ts"
respawn_delay=1
respawn_max=0
export SELFHOST_SERVER_URL="..."
export SELFHOST_AGENT_ID="..."
export SELFHOST_AGENT_KEY="..."

depend() {
    need net
    after firewall
}
```

**Legacy OpenRC (No `supervise-daemon`):**

```sh
#!/sbin/openrc-run
description="SelfHost Agent"
command="/path/to/bun"
command_args="run /var/lib/selfhost/agent.ts"
command_background="yes"
pidfile="/run/selfhost-agent.pid"
export SELFHOST_SERVER_URL="..."
export SELFHOST_AGENT_ID="..."
export SELFHOST_AGENT_KEY="..."
# Injected Restart Command:
export SELFHOST_RESTART_COMMAND="export PATH=$PATH:/sbin...; sleep 1 && [sudo] rc-service selfhost-agent restart"

depend() {
    need net
    after firewall
}
```

**Restart Logic (Legacy):**
1. Agent receives restart command.
2. Agent detects `SELFHOST_RESTART_COMMAND`.
3. Agent spawns this command as a **Detached Process** (independent of the agent).
4. Agent exits with Code 1.
5. Detached command waits 1s, then executes `rc-service selfhost-agent restart`.

### Permissions & Privileges

- **Install Time**: All modifying commands (`mv`, `chmod`, `tee`) are prefixed with `sudo` if the user is not root.
- **Runtime**: The service runs as `root` by default (Systemd/OpenRC default behavior unless `User=` is specified).
- **Restart Time**:
  - **Systemd/Supervised**: No permissions needed; the init system owns the lifecycle.
  - **Legacy OpenRC**: The detached command uses `sudo` (if needed) to call `rc-service`. Since the agent runs as root/sudo-capable user, it can spawn this privileged command.
