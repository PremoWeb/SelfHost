import { Client } from 'ssh2';
import { getServerById, updateServer } from './servers';
import { getPrivateKeyById } from './security';
import { getInstanceSettings } from './settings';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export type InstallStep = 'connecting' | 'detecting' | 'uploading' | 'installing_bun' | 'starting' | 'complete';

export async function installAgent(
	serverId: string, 
	teamId: string | null, 
	callbackUrlOverride?: string,
	onProgress?: (step: InstallStep, message: string) => void,
    onLog?: (message: string) => void
) {
	onProgress?.('connecting', 'Connecting to remote server via SSH...');
    onLog?.('[System] Starting installation...\n');
	
    // ... (rest of server/key fetching)

    // ... inside the Promise ...


	const server = await getServerById(serverId, teamId);
	if (!server) throw new Error('Server not found');

	if (!server.privateKeyId) throw new Error('No private key for this server');
	const privateKey = await getPrivateKeyById(server.privateKeyId, teamId || null, !teamId);
	if (!privateKey) throw new Error('Private key not found');

	// 1. Ensure agentKey exists
	let agentKey = server.agentKey;
	if (!agentKey) {
		agentKey = crypto.randomBytes(32).toString('hex');
		await updateServer(serverId, teamId, { agentKey });
	}

	// 2. Prepare Connection
	// 2. Prepare Connection transport
	let sock: any = undefined;
	let proxy: any = undefined;

	if (server.cloudflareTunnelHostname) {
		const { CloudflareAccessService } = await import('./cloudflare-access');
		const { Duplex } = await import('node:stream');

		proxy = await CloudflareAccessService.getSshProxyStream(
			server.cloudflareTunnelHostname,
			server.cloudflareAccessTokenId
		);
		
		sock = new Duplex({
			read() {},
			write(chunk, encoding, callback) {
				proxy.stdin.write(chunk, encoding, callback);
			}
		});

		proxy.stdout.on('data', (chunk: Buffer) => sock.push(chunk));
		proxy.stdout.on('end', () => sock.push(null));
		proxy.proc.on('error', (err: any) => sock.emit('error', err));
		proxy.proc.on('exit', (code: number) => {
			if (code !== 0) sock.emit('error', new Error(`cloudflared exited with code ${code}`));
		});
	}

	return new Promise<{ success: boolean; message: string; agentKey: string }>((resolve, reject) => {
		const conn = new Client();

		if (proxy) {
			conn.on('end', () => proxy.proc.kill());
			conn.on('error', () => proxy.proc.kill());
		}

		conn.on('ready', async () => {
			// 1. Determine Callback URL early
			const settings = await getInstanceSettings();
			let serverUrl = callbackUrlOverride || 'ws://localhost:5173';
			if (!callbackUrlOverride) {
				if (settings?.fqdn) {
					serverUrl = settings.fqdn.startsWith('http') ? settings.fqdn.replace(/^http/, 'ws') : `ws://${settings.fqdn}`;
					if (!serverUrl.includes(':', 6)) serverUrl += ':5173';
				} else if (process.env.SELFHOST_FQDN) {
					serverUrl = `ws://${process.env.SELFHOST_FQDN}:5173`;
				}
			}

			// Ensure the URL ends with /api/agent to match the WebSocket plugin path
			if (!serverUrl.endsWith('/api/agent')) {
				serverUrl = `${serverUrl.replace(/\/$/, '')}/api/agent`;
			}

			onProgress?.('detecting', 'Connected. Detecting system configuration...');

			// Detect architecture and init system
			conn.exec('uname -m && (ls /run/systemd/system > /dev/null 2>&1 && echo systemd || (ls /sbin/openrc > /dev/null 2>&1 && echo openrc || echo generic))', (err, stream) => {
				if (err) { conn.end(); return reject(err); }
				
				let output = '';
				stream.on('data', (data: Buffer) => output += data.toString());
				stream.on('close', () => {
					const lines = output.trim().split('\n');
					const initSystem = lines[1] || 'generic';
					
					// Detect environment (root/sudo)
					conn.exec('whoami && command -v sudo >/dev/null 2>&1 && echo "has_sudo" || echo "no_sudo"', (err, stream) => {
						if (err) { conn.end(); return reject(err); }
						let envOutput = '';
						stream.on('data', (data: Buffer) => envOutput += data.toString());
						stream.on('close', async () => {
							const isRoot = envOutput.includes('root');
							const hasSudo = envOutput.includes('has_sudo');
							const s = (hasSudo && !isRoot) ? 'sudo ' : '';
							
							
							// Check for existing Bun installation
							let existingBunPath = '';
							conn.exec('command -v bun && bun -v', (err, stream) => {
								if (err) { 
									// Bun likely not installed, proceed
									nextStep();
									return;
								}
								let bunOutput = '';
								stream.on('data', (d: Buffer) => bunOutput += d.toString());
								stream.on('close', () => {
									const lines = bunOutput.trim().split('\n');
									if (lines.length >= 2) {
										existingBunPath = lines[0].trim();
										const bunVersion = lines[1].trim();
									}
									nextStep();
								});
							});

							function nextStep() {
								onProgress?.('uploading', 'Preparing SelfHost Agent source...');
								// ... Proceed with file reading
								readSource();
							}

							async function readSource() {
								// 3. Read local source
								const agentSourcePath = path.resolve(process.cwd(), 'agent/src/index.ts');
								const sourceBuffer = await fs.readFile(agentSourcePath);
								// ... (rest of the logic)
								uploadSource(sourceBuffer);
							}
							
							async function uploadSource(sourceBuffer: Buffer) {
								// ... existing callback URL logic ...
								// Call conn.sftp here
								startSftp(sourceBuffer);
							}

							async function startSftp(sourceBuffer: Buffer) {
								conn.sftp((err, sftp) => {
									if (err) { conn.end(); return reject(err); }

									onProgress?.('uploading', 'Uploading source to /tmp/selfhost-agent.ts...');
									sftp.writeFile('/tmp/selfhost-agent.ts', sourceBuffer, (err) => {
										if (err) { conn.end(); return reject(err); }

										onProgress?.('installing_bun', 'Checking/Installing Bun runtime...');

										// Helper to execute commands sequentially
										const execCommand = (cmd: string): Promise<string> => {
											console.log(`[SSH Command] ${cmd}`);
											return new Promise((resolveExec, rejectExec) => {
												conn.exec(cmd, (err, stream) => {
													if (err) return rejectExec(err);
													let output = '';
													stream.on('data', (d: Buffer) => {
														const chunk = d.toString();
														process.stdout.write(chunk.split('\n').map(l => l ? `[SSH stdout] ${l}\n` : '').join(''));
														output += chunk;
													});
													stream.stderr.on('data', (d: Buffer) => {
														const chunk = d.toString();
														process.stderr.write(chunk.split('\n').map(l => l ? `[SSH stderr] ${l}\n` : '').join(''));
														// stderr is also output for some tools
														output += chunk;
													});
													stream.on('close', (code: any) => {
														// Treat null as 0 (success) or handle undefined exit codes
														if (code !== 0 && code !== null) rejectExec(new Error(`Command failed with code ${code}: ${cmd}\nOutput: ${output}`));
														else resolveExec(output);
													});
												});
											});
										};

										// Execute steps sequentially
										(async () => {
											try {
												// Step 0: Kill existing agents (zombies) and clear logs
												await execCommand(`${s}pkill -f agent.ts || true`);
												await execCommand(`${s}pkill -f start.sh || true`);
												await execCommand(`${s}rm -f /var/log/selfhost-agent.log || true`);
												await execCommand(`${s}rm -f /tmp/selfhost-agent-wrapper.log || true`);

												// Step 1: Install Dependencies (Bun, etc.)
												if (!existingBunPath) {
													onProgress?.('installing_bun', 'Installing Bun runtime and dependencies...');
													
													// Detect and install dependencies based on package manager
													// For apt: try install first (works if packages in cache), update only if install fails
													// Make update non-fatal to handle problematic enterprise repos (like Proxmox)
													const depsCmd = initSystem === 'openrc' 
														? `${s}apk add curl bash unzip`
														: `(${s}command -v apt-get >/dev/null 2>&1 && (${s}DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --fix-missing curl unzip bash 2>/dev/null || (${s}DEBIAN_FRONTEND=noninteractive apt-get update -qq 2>&1 | grep -vE "(401 Unauthorized|is not signed|Failed to fetch)" >&2; true); ${s}DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --fix-missing curl unzip bash)) || (${s}command -v yum >/dev/null 2>&1 && ${s}yum install -y -q curl unzip bash) || (${s}command -v dnf >/dev/null 2>&1 && ${s}dnf install -y -q curl unzip bash) || true`;
													
													const installCmds = [
														depsCmd,
														'command -v bun >/dev/null 2>&1 || (curl -fsSL https://bun.sh/install | bash)',
														`export BUN_INSTALL="$HOME/.bun"`,
														`export PATH="$BUN_INSTALL/bin:$PATH"`,
														`${s}mkdir -p /var/lib/selfhost`,
														`${s}mv -f /tmp/selfhost-agent.ts /var/lib/selfhost/agent.ts`,
														`${s}chmod +x /var/lib/selfhost/agent.ts`
													];
													await execCommand(installCmds.join(' && '));
												} else {
													// Just move the files if Bun exists
													onProgress?.('uploading', 'Updating agent source...');
													await execCommand([
														`${s}mkdir -p /var/lib/selfhost`,
														`${s}mv -f /tmp/selfhost-agent.ts /var/lib/selfhost/agent.ts`,
														`${s}chmod +x /var/lib/selfhost/agent.ts`
													].join(' && '));
												}

												// Determine absolute path to Bun
												let bunPath = existingBunPath || '/root/.bun/bin/bun';
												if (!existingBunPath && !isRoot) {
													bunPath = `/home/${server.user}/.bun/bin/bun`;
												}

												// Step 2: Write start.sh (Base64 encoded to prevent escaping issues)
												onProgress?.('starting', 'Configuring startup script...');
												
												// "Smart Wrapper" - Internal supervision loop (POSIX sh compliant)
												const startScript = `#!/bin/sh
export SELFHOST_SERVER_URL="${serverUrl}"
export SELFHOST_AGENT_ID="${server.id}"
export SELFHOST_AGENT_KEY="${agentKey}"

# Ensure we can find bun if it's in a user directory but we act as root
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Redirect all output to the main log file for visibility in UI
exec 1>>/var/log/selfhost-agent.log 2>&1

echo "--- Wrapper started at $(date) (PID: $$) ---"

cleanup() {
    echo "Received stop signal. Killing agent PID $AGENT_PID..."
    kill -TERM "$AGENT_PID" 2>/dev/null
    wait "$AGENT_PID"
    exit 0
}

# Trap TERM and INT signals
trap cleanup TERM INT

while true; do
    echo "[$(date)] Starting SelfHost Agent..."
    
    # Run agent in background
    ${bunPath} run /var/lib/selfhost/agent.ts &
    AGENT_PID=$!
    
    # Wait for the specific PID
    wait "$AGENT_PID"
    EXIT_CODE=$?
    
    echo "Agent exited with code $EXIT_CODE"
    
    # Exit 0 means clean shutdown requested by agent (if ever) or unrelated
    # But usually 130/143 is signal.
    # If we want to restart on crash (1), or disconnection...
    # We basically always restart unless the wrapper itself is killed (trap).
    # But if agent exits 0, maybe we should stop?
    if [ "$EXIT_CODE" -eq 0 ]; then
        echo "Agent exited cleanly (0). Stopping service."
        exit 0
    fi
    
    echo "Agent exited with error or restart request. Restarting in 1s..."
    sleep 1
done
`;
												const startScriptB64 = Buffer.from(startScript).toString('base64');
												// We stop the service first to ensure we can overwrite the running script safely (though Linux often allows it)
												await execCommand(`${s}pkill -f start.sh || true`); 
												await execCommand(`echo "${startScriptB64}" | base64 -d | ${s}tee /var/lib/selfhost/start.sh > /dev/null && ${s}chmod +x /var/lib/selfhost/start.sh`);

												// Step 3: Configure Service
												let serviceFile = '';
												let servicePath = '';
												let enableCmd = '';

												if (initSystem === 'systemd') {
													serviceFile = `[Unit]\nDescription=SelfHost Agent\nAfter=network.target\n\n[Service]\nType=simple\nExecStart=/var/lib/selfhost/start.sh\nRestart=always\nRestartSec=1\n\n[Install]\nWantedBy=multi-user.target\n`;
													servicePath = '/etc/systemd/system/selfhost-agent.service';
													enableCmd = `${s}systemctl daemon-reload && ${s}systemctl enable selfhost-agent && ${s}systemctl restart selfhost-agent`;
												} else if (initSystem === 'openrc') {
													servicePath = '/etc/init.d/selfhost-agent';
													const supervisedFile = `#!/sbin/openrc-run\ndescription="SelfHost Agent"\n` +
														`supervisor="supervise-daemon"\n` +
														`command="/var/lib/selfhost/start.sh"\n` +
														`respawn_delay=1\n` +
														`respawn_max=0\n` +
														`depend() {\n    need net\n    after firewall\n}\n`;

													const legacyFile = `#!/sbin/openrc-run\ndescription="SelfHost Agent"\n` +
														`command="/var/lib/selfhost/start.sh"\n` +
														`command_background="yes"\n` +
														`pidfile="/run/selfhost-agent.pid"\n` +
														`respawn_delay=1\n` +
														`respawn_max=0\n` +
														`depend() {\n    need net\n    after firewall\n}\n`;
													
													// We need to determine which content to write.
													// We can't easily switch file content in a single echo command based on remote check if we pre-calculate base64.
													// So we will run the check remotely and choose the content ourselves? 
													// No, we can't see the result easily.
													// Robust way: Write a small script to generate the service file or check supervise-daemon now.
													
													// Check supervise-daemon availability first
													try {
														await execCommand('command -v supervise-daemon');
														serviceFile = supervisedFile;
													} catch (e) {
														serviceFile = legacyFile;
													}
													onProgress?.('starting', `Writing service file to ${servicePath}...`);
													// Ensure base64 exists and remove old service file to force update
													await execCommand('command -v base64');
													await execCommand(`${s}rm -f ${servicePath}`);
													
													enableCmd = `${s}chmod +x /etc/init.d/selfhost-agent && ${s}rc-update add selfhost-agent default && ${s}rc-service selfhost-agent restart`;
												}

												const serviceFileB64 = Buffer.from(serviceFile).toString('base64');
												await execCommand(`echo "${serviceFileB64}" | base64 -d | ${s}tee ${servicePath} > /dev/null`);

												// Step 4: Start Service
												onProgress?.('starting', 'Starting SelfHost Agent service...');
												await execCommand(enableCmd);

												conn.end();
												onProgress?.('complete', 'SelfHost Agent is now active!');
												await updateServer(serverId, teamId, { connectionType: 'agent', status: 'waiting' });
												resolve({ success: true, message: 'SelfHost Agent installed', agentKey });

											} catch (err: any) {
												conn.end();
												reject(err);
											}
										})();
									});
								});
							}
						});
					});
				});
			});
		})
		.on('error', (err) => {
			reject(err);
		})
		.connect({
			username: server.user,
			privateKey: privateKey.privateKey,
			readyTimeout: 30000,
			...(sock ? { sock } : { host: server.ip, port: server.port })
		});
	});
}

export async function getLocalAgentChecksum() {
	try {
		const agentSourcePath = path.resolve(process.cwd(), 'agent/src/index.ts');
		const buffer = await fs.readFile(agentSourcePath);
		const hash = crypto.createHash('sha256').update(buffer).digest('hex');
		return hash;
	} catch (err) {
		return null;
	}
}

export async function getLocalAgentVersion() {
	try {
		const agentSourcePath = path.resolve(process.cwd(), 'agent/src/index.ts');
		const stats = await fs.stat(agentSourcePath);
		const d = stats.mtime;
		return `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
	} catch (err) {
		return '0.0.0';
	}
}
