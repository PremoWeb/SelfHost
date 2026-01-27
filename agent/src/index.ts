import * as fs from "node:fs";
import { hostname } from "node:os";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";

const SERVER_URL = process.env.SELFHOST_SERVER_URL || "ws://localhost:5173/api/agent";
const AGENT_ID = process.env.SELFHOST_AGENT_ID || "local-agent";
const AGENT_KEY = process.env.SELFHOST_AGENT_KEY || "development-key";
const RESTART_COMMAND = process.env.SELFHOST_RESTART_COMMAND;

console.log(`🚀 SelfHost Agent starting...`);
console.log(`Connecting to: ${SERVER_URL}`);
console.log(`Agent ID: ${AGENT_ID}`);
if (RESTART_COMMAND) console.log(`Restart Command set: ${RESTART_COMMAND}`);

async function getAgentInfo() {
    try {
        // Prioritize the standard installation path, fallback to dynamic detection
        const standardPath = "/var/lib/selfhost/agent.ts";
        const selfPath = (await Bun.file(standardPath).exists()) ? standardPath : ((Bun as any).main?.filename || (import.meta as any).filename || process.argv[1]);
        
        let file = Bun.file(selfPath);
        
        if (await file.exists()) {
            const buffer = await file.arrayBuffer();
            const hasher = new Bun.CryptoHasher("sha256");
            hasher.update(buffer);
            const checksum = hasher.digest("hex");
            
            
            // Try to get file stats for "installed at"
            const stat = await fs.promises.stat(file.name || selfPath);
            const d = stat.mtime || new Date(stat.birthtimeMs || stat.ctimeMs);
            const version = `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;

            return {
                checksum,
                version,
                installedAt: stat.birthtimeMs || stat.ctimeMs || Date.now()
            };
        } else {
            console.error(`[Agent] ❌ Could not find agent source at any path!`);
        }
    } catch (e) {
        console.error("Failed to calculate agent info:", e);
    }
    return { checksum: "unknown", version: "dev", installedAt: Date.now() };
}

async function connect() {
    const info = await getAgentInfo();
    const ws = new WebSocket(SERVER_URL, {
        headers: {
            "x-selfhost-agent-id": AGENT_ID,
            "x-selfhost-agent-key": AGENT_KEY,
            "x-selfhost-version": info.version,
            "x-selfhost-agent-checksum": info.checksum
        }
    } as any);

    ws.onopen = () => {
        console.log(`✅ Connected to SelfHost Server (Version: ${info.version})`);
        ws.send(JSON.stringify({ 
            type: "hello", 
            payload: { 
                hostname: hostname(),
                os: process.platform,
                arch: process.arch,
                uptime: process.uptime(),
                version: info.version,
                checksum: info.checksum,
                installedAt: info.installedAt
            } 
        }));

        // Start health reporting
        setInterval(() => {
            sendHealth(ws, info.checksum);
        }, 5000);
    };

    async function sendHealth(ws: WebSocket, checksum: string) {
        if (ws.readyState !== 1) return;

        const loadAvg = os.loadavg();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

        // Get disk usage (root partition)
        let diskUsage = 0;
        try {
            const df = Bun.spawnSync(["df", "-h", "/"]);
            const output = df.stdout.toString();
            const lastLine = output.trim().split("\n").pop() || "";
            const percentMatch = lastLine.match(/(\d+)%/);
            if (percentMatch) diskUsage = parseInt(percentMatch[1]);
        } catch (e) {}

        // Check Traefik proxy status
        let proxyStatus = 'unknown';
        try {
            const docker = Bun.spawnSync(["docker", "ps", "--filter", "name=traefik", "--format", "{{.Status}}"]);
            if (docker.exitCode === 0) {
                const output = docker.stdout.toString().trim();
                if (output && output.includes('Up')) {
                    proxyStatus = 'running';
                } else if (output) {
                    proxyStatus = 'stopped';
                } else {
                    proxyStatus = 'not_installed';
                }
            }
        } catch (e) {
            proxyStatus = 'unknown';
        }

        console.log(`📊 Stats: CPU=${loadAvg[0]}, RAM=${memUsage}%, Disk=${diskUsage}%, Proxy=${proxyStatus}`);
        ws.send(JSON.stringify({
            type: "health",
            payload: {
                cpu: loadAvg[0], // 1 min load avg
                memory: memUsage,
                disk: diskUsage,
                uptime: process.uptime(),
                proxyStatus,
                checksum
            }
        }));
    }

    async function verifySignature(payload: any, signature: string) {
        const hmac = crypto.createHmac('sha256', AGENT_KEY);
        hmac.update(JSON.stringify(payload));
        const calculated = hmac.digest('hex');
        return calculated === signature;
    }

    async function updateServiceUrl(newUrl: string) {
        console.log(`🔄 Updating Service URL to: ${newUrl}`);
        
        // Detect init system
        const isSystemd = await Bun.file('/etc/systemd/system/selfhost-agent.service').exists();
        const isOpenRC = await Bun.file('/etc/init.d/selfhost-agent').exists();

        if (isSystemd) {
            const servicePath = '/etc/systemd/system/selfhost-agent.service';
            let content = await Bun.file(servicePath).text();
            content = content.replace(/Environment=SELFHOST_SERVER_URL=.*/, `Environment=SELFHOST_SERVER_URL=${newUrl}`);
            await Bun.write(servicePath, content);
            
            await Bun.spawn(["systemctl", "daemon-reload"]).exited;
            await Bun.spawn(["systemctl", "restart", "selfhost-agent"]).exited;
        } else if (isOpenRC) {
            const servicePath = '/etc/init.d/selfhost-agent';
            let content = await Bun.file(servicePath).text();
            content = content.replace(/export SELFHOST_SERVER_URL=".+"/, `export SELFHOST_SERVER_URL="${newUrl}"`);
            await Bun.write(servicePath, content);
            
            await Bun.spawn(["rc-service", "selfhost-agent", "restart"]).exited;
        }
    }

    ws.onmessage = async (event) => {
        try {
            const message = JSON.parse(event.data.toString());
            console.log(`📩 Received: ${message.type}`);

            switch (message.type) {
                case "ping":
                    ws.send(JSON.stringify({ type: "pong" }));
                    break;

                case "execute":
                    await handleExecute(ws, message.id, message.payload.command);
                    break;

                case "wireguard":
                    await handleWireguard(ws, message.id, message.payload);
                    break;

                case "write_file":
                    await handleWriteFile(ws, message.id, message.payload);
                    break;
                
                case "update_url": {
                    const { url, signature, timestamp } = message.payload;
                    
                    // Verify timestamp freshness (5 min window)
                    if (Math.abs(Date.now() - timestamp) > 300000) {
                        console.error('❌ Update URL request expired');
                        return;
                    }

                    // Verify signature
                    const isValid = await verifySignature({ url, timestamp }, signature);
                    if (!isValid) {
                        console.error('❌ Invalid signature for URL update');
                        return;
                    }

                    await updateServiceUrl(url);
                    break;
                }

                case "restart":
                    await handleRestart(ws, message.id);
                    break;

                case "reboot":
                    await handleReboot(ws, message.id, message.payload);
                    break;

                default:
                    console.warn(`Unknown message type: ${message.type}`);
            }
        } catch (err) {
            console.error("Failed to parse message", err);
        }
    };

    ws.onclose = () => {
        console.log("❌ Connection lost. Reconnecting in 5s...");
        setTimeout(connect, 5000);
    };

    ws.onerror = (event: Event) => {
        // Bun's WebSocket error event structure
        const err = event as unknown as { message?: string; error?: any };
        const msg = err.message || (err.error && err.error.message) || "Unknown error";
        
        if (msg.includes('Expected 101 status code')) {
             console.error(`❌ Connection failed: Server not reachable or tunnel down (Expected 101, got HTTP response)`);
        } else if (msg.includes('Connection refused')) {
             console.error(`❌ Connection failed: Connection refused`);
        } else {
             console.error(`❌ WebSocket Error: ${msg}`);
        }
    };
}

async function handleExecute(ws: WebSocket, msgId: string, command: string) {
    console.log(`💻 Executing: ${command}`);
    
    try {
        const proc = Bun.spawn(["/bin/sh", "-c", command], {
            stdout: "pipe",
            stderr: "pipe",
            env: {
                ...process.env,
                TERM: "xterm-256color"
            }
        });

        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;

        ws.send(JSON.stringify({
            type: "execute_result",
            id: msgId,
            payload: {
                success: exitCode === 0,
                stdout,
                stderr,
                exitCode
            }
        }));
    } catch (err: any) {
        ws.send(JSON.stringify({
            type: "execute_result",
            id: msgId,
            payload: {
                success: false,
                stderr: err.message,
                exitCode: 1
            }
        }));
    }
}

async function handleWireguard(ws: WebSocket, msgId: string, payload: any) {
    const { action } = payload;
    console.log(`🛡️ Wireguard Action: ${action}`);

    try {
        let result = "";
        if (action === "status") {
            const proc = Bun.spawn(["wg", "show"]);
            result = await new Response(proc.stdout).text();
        } else {
            result = `Action ${action} not yet implemented in agent`;
        }

        ws.send(JSON.stringify({
            type: "wireguard_result",
            id: msgId,
            payload: {
                success: true,
                output: result
            }
        }));
    } catch (err: any) {
        ws.send(JSON.stringify({
            type: "wireguard_result",
            id: msgId,
            payload: {
                success: false,
                error: err.message
            }
        }));
    }
}

connect();

async function handleWriteFile(ws: WebSocket, msgId: string, payload: { path: string, content: string, append?: boolean }) {
    const { path: filePath, content, append } = payload;
    console.log(`📝 Writing file: ${filePath}`);

    try {
        const dir = path.dirname(filePath);
        await Bun.spawn(["mkdir", "-p", dir]).exited;

        if (append) {
            await fs.promises.appendFile(filePath, content);
        } else {
            await Bun.write(filePath, content);
        }

        ws.send(JSON.stringify({
            type: "write_file_result",
            id: msgId,
            payload: { success: true }
        }));
    } catch (err: any) {
        console.error(`❌ Write failed: ${err.message}`);
        ws.send(JSON.stringify({
            type: "write_file_result",
            id: msgId,
            payload: { success: false, error: err.message }
        }));
    }
}

async function handleRestart(ws: WebSocket, msgId: string) {
    console.log(`🔄 Restarting agent...`);

    try {
        // Send success message before exiting
        // The init system (systemd/openrc) will handle the actual restart 
        // because we installed with 'Restart=always'
        ws.send(JSON.stringify({
            type: "restart_result",
            id: msgId,
            payload: { success: true, message: "Exiting to trigger service restart..." }
        }));

        // Small delay to ensure message is sent
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log("👋 Agent exiting for restart...");

        // We rely on the external wrapper (start.sh) to restart us when we exit with code 1.
        console.log("👋 Agent exiting (code 1) to force restart...");
        process.exit(1);
    } catch (err: any) {
        console.error(`❌ Restart trigger failed: ${err.message}`);
        ws.send(JSON.stringify({
            type: "restart_result",
            id: msgId,
            payload: { success: false, error: err.message }
        }));
    }
}

async function handleReboot(ws: WebSocket, msgId: string, payload: any = {}) {
    const type = payload.type || 'graceful';
    console.log(`🔌 [${type.toUpperCase()}] Rebooting server...`);

    try {
        // Send success message before rebooting
        ws.send(JSON.stringify({
            type: "reboot_result",
            id: msgId,
            payload: { success: true, message: "Rebooting server..." }
        }));

        // Small delay to ensure message is sent
        await new Promise(resolve => setTimeout(resolve, 500));

        // Execute reboot command
        await Bun.spawn(["reboot"]).exited;
    } catch (err: any) {
        console.error(`❌ Reboot failed: ${err.message}`);
        ws.send(JSON.stringify({
            type: "reboot_result",
            id: msgId,
            payload: { success: false, error: err.message }
        }));
    }
}
