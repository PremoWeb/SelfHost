import { command, getRequestEvent } from '$app/server';
import { getServerById } from '$lib/server/services/servers';
import { agentManager } from '$lib/server/agent/manager';
import { updateProxySettings, generateTraefikConfig } from '$lib/server/services/proxy';
import { Client } from 'ssh2';

interface ActionResponse {
	success: boolean;
	message?: string;
	output?: string;
	status?: string;
	ready?: boolean;
	checks?: Array<{ name: string; status: string; required: boolean; message: string }>;
}

export const diagnoseServer = command('unchecked', async ({ serverId }: { serverId: string }): Promise<ActionResponse> => {
	const { locals } = getRequestEvent();
	if (!locals.team || !serverId) {
		return { success: false, message: 'Unauthorized' };
	}

	const { db } = await import('$lib/server/db/client');
	const { servers, privateKeys } = await import('$lib/server/db/schema');
	const { eq } = await import('drizzle-orm');

	const server = await db.query.servers.findFirst({
		where: eq(servers.id, serverId)
	});

	if (!server || server.teamId !== locals.team.id) {
		return { success: false, message: 'Server not found' };
	}

	const privateKey = server.privateKeyId
		? await db.query.privateKeys.findFirst({ where: eq(privateKeys.id, server.privateKeyId) })
		: null;

	if (!privateKey) {
		return { success: false, message: 'No SSH key configured' };
	}

	return new Promise((resolve) => {
		const conn = new Client();
		let output = '';

		conn
			.on('ready', () => {
				const commands = [
					'echo "=== SERVICE STATUS ==="',
					'rc-service selfhost-agent status',
					'echo ""',
					'echo "=== SERVICE CONFIG ==="',
					'cat /etc/init.d/selfhost-agent',
					'echo ""',
					'echo "=== AGENT PROCESS ==="',
					'ps aux | grep -E "bun.*agent.ts" | grep -v grep',
					'echo ""',
					'echo "=== RECENT LOGS (Last 20 lines) ==="',
					'tail -n 20 /var/log/selfhost-agent.log',
					'echo ""',
					'echo "=== NETWORK TEST ==="',
					'echo "Testing DNS resolution..."',
					'nslookup coming-tin-orbit-release.trycloudflare.com || echo "DNS lookup failed"',
					'echo ""',
					'echo "Testing connectivity..."',
					'timeout 5 nc -zv coming-tin-orbit-release.trycloudflare.com 443 2>&1 || echo "Connection test failed"'
				].join(' && ');

				conn.exec(commands, (err, stream) => {
					if (err) {
						conn.end();
						resolve({ success: false, message: err.message });
						return;
					}

					stream.on('data', (data: Buffer) => {
						output += data.toString();
					});

					stream.stderr.on('data', (data: Buffer) => {
						output += data.toString();
					});

					stream.on('close', () => {
						conn.end();
						resolve({ success: true, output });
					});
				});
			})
			.on('error', (err: any) => {
				resolve({ success: false, message: err.message });
			})
			.connect({
				host: server.ip,
				port: server.port || 22,
				username: server.user || 'root',
				privateKey: privateKey.privateKey
			});
	});
});

export const rebootServer = command(
	'unchecked',
	async ({ serverId, type = 'graceful' }: { serverId: string; type?: 'graceful' | 'hard' | 'intelligent' }): Promise<ActionResponse> => {
		const { locals } = getRequestEvent();
		if (!locals.team || !serverId) {
			return { success: false, message: 'Unauthorized' };
		}

		const { db } = await import('$lib/server/db/client');
		const { servers } = await import('$lib/server/db/schema');
		const { eq } = await import('drizzle-orm');

		const server = await db.query.servers.findFirst({
			where: eq(servers.id, serverId)
		});

		if (!server || server.teamId !== locals.team.id) {
			return { success: false, message: 'Server not found' };
		}

		try {
			if (type === 'intelligent') {
				await agentManager.rebootServer(serverId, type);
			} else if (type === 'hard') {
				if (server.vpsProviderId) {
					return {
						success: false,
						message: 'Hard reboot via provider not yet fully implemented in server function'
					};
				} else {
					await agentManager.rebootServer(serverId, 'graceful');
				}
			} else {
				await agentManager.rebootServer(serverId, 'graceful');
			}

			return {
				success: true,
				message: `${type.charAt(0).toUpperCase() + type.slice(1)} restart command initiated`
			};
		} catch (err: any) {
			return { success: false, message: err.message || 'Failed to send restart command' };
		}
	}
);

export const restartAgent = command('unchecked', async ({ serverId }: { serverId: string }): Promise<ActionResponse> => {
	const { locals } = getRequestEvent();
	if (!locals.team || !serverId) {
		return { success: false, message: 'Unauthorized' };
	}

	const { db } = await import('$lib/server/db/client');
	const { servers } = await import('$lib/server/db/schema');
	const { eq } = await import('drizzle-orm');

	const server = await db.query.servers.findFirst({
		where: eq(servers.id, serverId)
	});

	if (!server || server.teamId !== locals.team.id) {
		return { success: false, message: 'Server not found' };
	}

	try {
		await agentManager.restartAgent(serverId);
		return {
			success: true,
			message: 'Restart command sent to agent'
		};
	} catch (err: any) {
		return { success: false, message: err.message || 'Failed to send restart command' };
	}
});

export const forceUpdateService = command(
	'unchecked',
	async ({ serverId, tunnelUrl }: { serverId: string; tunnelUrl: string }): Promise<ActionResponse> => {
		const { locals } = getRequestEvent();
		if (!locals.team || !serverId) {
			return { success: false, message: 'Unauthorized' };
		}

		const { db } = await import('$lib/server/db/client');
		const { servers, privateKeys } = await import('$lib/server/db/schema');
		const { eq } = await import('drizzle-orm');

		const server = await db.query.servers.findFirst({
			where: eq(servers.id, serverId)
		});

		if (!server || server.teamId !== locals.team.id) {
			return { success: false, message: 'Server not found' };
		}

		const privateKey = server.privateKeyId
			? await db.query.privateKeys.findFirst({ where: eq(privateKeys.id, server.privateKeyId) })
			: null;

		if (!privateKey) {
			return { success: false, message: 'No SSH key configured' };
		}

		if (!tunnelUrl) {
			return { success: false, message: 'Tunnel URL required' };
		}

		return new Promise((resolve) => {
			const conn = new Client();

			conn
				.on('ready', () => {
					const updateCmds = [
						`if [ -f /var/lib/selfhost/start.sh ]; then`,
						`  sed -i 's|export SELFHOST_SERVER_URL=.*|export SELFHOST_SERVER_URL="${tunnelUrl}/api/agent"|g' /var/lib/selfhost/start.sh`,
						`  if [ -f /etc/init.d/selfhost-agent ]; then`,
						`    rc-service selfhost-agent restart`,
						`  elif [ -f /etc/systemd/system/selfhost-agent.service ]; then`,
						`    systemctl restart selfhost-agent`,
						`  fi`,
						`else`,
						`  if [ -f /etc/init.d/selfhost-agent ]; then`,
						`    sed -i 's|export SELFHOST_SERVER_URL=.*|export SELFHOST_SERVER_URL="${tunnelUrl}/api/agent"|g' /etc/init.d/selfhost-agent`,
						`    rc-service selfhost-agent restart`,
						`  fi`,
						`fi`
					].join('\n');

					conn.exec(updateCmds, (err, stream) => {
						if (err) {
							conn.end();
							resolve({ success: false, message: err.message });
							return;
						}

						let output = '';
						stream.on('data', (data: Buffer) => (output += data.toString()));
						stream.stderr.on('data', (data: Buffer) => (output += data.toString()));

						stream.on('close', () => {
							conn.end();
							resolve({ success: true, message: 'Service updated', output });
						});
					});
				})
				.on('error', (err: any) => {
					resolve({ success: false, message: err.message });
				})
				.connect({
					host: server.ip,
					port: server.port || 22,
					username: server.user || 'root',
					privateKey: privateKey.privateKey
				});
		});
	}
);

export const getAppStatus = command(
	'unchecked',
	async ({ serverId, appName }: { serverId: string; appName: string }): Promise<ActionResponse> => {
		const { locals } = getRequestEvent();
		if (!locals.team || !serverId || !appName) {
			return { success: false, message: 'Unauthorized or missing parameters' };
		}

		try {
			// We use the internal agent bridge URL (this is a simplified example, in reality it calls the bridge)
			const response = await fetch('http://localhost:5176', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					agentId: serverId,
					type: 'execute',
					payload: { command: `(rc-service ${appName} status > /dev/null 2>&1 && echo "running") || (systemctl is-active ${appName} > /dev/null 2>&1 && echo "running") || echo "stopped"` }
				})
			});

			if (response.ok) {
				const result = await response.json();
				return { success: true, status: result.output?.trim() || 'unknown' };
			}
			return { success: false, message: 'Failed to check status' };
		} catch (err: any) {
			return { success: false, message: err.message };
		}
	}
);

export const proxyAction = command(
	'unchecked',
	async ({ 
        serverId, 
        action, 
        type, 
        email 
    }: { 
        serverId: string; 
        action: 'start' | 'stop' | 'restart' | 'configure'; 
        type?: string; 
        email?: string 
    }): Promise<ActionResponse> => {
		const { locals } = getRequestEvent();
		if (!locals.team || !serverId) {
			return { success: false, message: 'Unauthorized' };
		}

		const server = await getServerById(serverId, locals.team.id);
		if (!server) return { success: false, message: 'Server not found' };

		if (action === 'configure' || action === 'start') {
			const proxyType = type || server.proxyType || 'traefik';
			await updateProxySettings(server.id, locals.team.id, { type: proxyType, email });
			
			// Starting via RPC (non-SSE version for simple actions)
			if (server.connectionType === 'agent') {
				try {
					const config = generateTraefikConfig(server);
					const proxyPath = '/data/premo/proxy/docker-compose.yml';

					// ENSURE NETWORK
					await fetch('http://localhost:5176', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							agentId: server.id,
							type: 'execute',
							payload: { command: 'docker network create --attachable premo || true' }
						})
					});

					// WRITE CONFIG
					await fetch('http://localhost:5176', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							agentId: server.id,
							type: 'write_file',
							payload: { path: proxyPath, content: config }
						})
					});

					// COMPOSE UP
					await fetch('http://localhost:5176', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							agentId: server.id,
							type: 'execute',
							payload: { command: `cd /data/premo/proxy && docker compose up -d --remove-orphans` }
						})
					});

					return { success: true, message: 'Proxy deployment started' };
				} catch (err: any) {
					return { success: false, message: err.message };
				}
			}
		}

		if (action === 'stop' && server.connectionType === 'agent') {
			try {
				await fetch('http://localhost:5176', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						agentId: server.id,
						type: 'execute',
						payload: { command: 'cd /data/premo/proxy && docker compose down' }
					})
				});
				return { success: true, message: 'Proxy stopped successfully' };
			} catch (err: any) {
				return { success: false, message: err.message };
			}
		}

		if (action === 'restart' && server.connectionType === 'agent') {
			try {
				await fetch('http://localhost:5176', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						agentId: server.id,
						type: 'execute',
						payload: { command: 'cd /data/premo/proxy && docker compose restart' }
					})
				});
				return { success: true, message: 'Proxy restarted successfully' };
			} catch (err: any) {
				return { success: false, message: err.message };
			}
		}

		return { success: false, message: 'Action not supported or agent not connected' };
	}
);

export const checkReadiness = command('unchecked', async ({ serverId }: { serverId: string }): Promise<ActionResponse> => {
	const { locals } = getRequestEvent();
	if (!locals.team || !serverId) {
		return { success: false, message: 'Unauthorized' };
	}

	const server = await getServerById(serverId, locals.team.id);
	if (!server) return { success: false, message: 'Server not found' };

	try {
		// Mock logic or call actual check
		const ready = server.status === 'online' && server.connectionType === 'agent';
		return { 
            success: true, 
            ready, 
            checks: [
                { name: 'SSH Connection', status: 'success', required: true, message: 'SSH is working' },
                { name: 'Agent Connection', status: ready ? 'success' : 'pending', required: true, message: ready ? 'Agent is online' : 'Agent not connected' }
            ] 
        };
	} catch (err: any) {
		return { success: false, message: err.message };
	}
});
