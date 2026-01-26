import { db } from '../db/client';
import { servers, destinations, applications, databases, quickDeployApps } from '../db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import type { NewServer } from '../db/schema';

/**
 * Get all servers for a team (backward compatibility)
 * Also supports ownerType/ownerId model
 */
export async function getServersByTeam(teamId: string | null | undefined) {
	// if (!teamId) return []; // Allow null teamId for God mode to fetch all
	try {
        const query = sql`
            SELECT 
                s.*,
                COALESCE(app_counts.count, 0) + COALESCE(qd_counts.count, 0) as application_count,
                COALESCE(db_counts.count, 0) as database_count,
                p.name as provider_name,
                p.type as provider_type
            FROM ${servers} s
            LEFT JOIN vps_providers p ON s.vps_provider_id = p.id
            LEFT JOIN (
                SELECT d.server_id, COUNT(a.id) as count
                FROM ${destinations} d
                JOIN ${applications} a ON a.destination_id = d.id
                GROUP BY d.server_id
            ) app_counts ON app_counts.server_id = s.id
            LEFT JOIN (
                SELECT d.server_id, COUNT(db.id) as count
                FROM ${destinations} d
                JOIN ${databases} db ON db.destination_id = d.id
                GROUP BY d.server_id
            ) db_counts ON db_counts.server_id = s.id
            LEFT JOIN (
                SELECT server_id, COUNT(*) as count
                FROM ${quickDeployApps}
                GROUP BY server_id
            ) qd_counts ON qd_counts.server_id = s.id
            WHERE ${teamId ? sql`s.team_id = ${teamId}` : sql`1=1`}
            ORDER BY s.created_at ASC
        `;

        const result = await db.all(query);
        return result.map((row: any) => ({
            ...row,
            application_count: Number(row.application_count),
            database_count: Number(row.database_count),
            tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
            healthCpu: row.health_cpu || 0,
            healthMemory: row.health_memory || 0,
            healthDisk: row.health_disk || 0,
            healthUpdatedAt: row.health_updated_at ? new Date(row.health_updated_at as string) : null,
            connectionType: row.connection_type,
            privateKeyId: row.private_key_id,
            vpsProviderId: row.vps_provider_id,
            cloudflareTunnelHostname: row.cloudflare_tunnel_hostname,
            agentChecksum: row.agent_checksum,
            agentVersion: row.agent_version,
            agentInstalledAt: row.agent_installed_at ? new Date(row.agent_installed_at as string) : null,
            providerName: row.provider_name,
            providerType: row.provider_type,
            createdAt: new Date(row.created_at as string),
            updatedAt: new Date(row.updated_at as string)
        })) as any[];
	} catch (err: any) {
		throw err;
	}
}

/**
 * Get server by UUID
 * Supports both teamId (backward compatibility) and ownerType/ownerId model
 */
export async function getServerById(serverId: string, teamId: string | null | undefined) {
	try {
        const query = sql`
            SELECT 
                s.*,
                COALESCE(app_counts.count, 0) + COALESCE(qd_counts.count, 0) as application_count,
                COALESCE(db_counts.count, 0) as database_count,
                p.name as provider_name,
                p.type as provider_type
            FROM ${servers} s
            LEFT JOIN vps_providers p ON s.vps_provider_id = p.id
            LEFT JOIN (
                SELECT d.server_id, COUNT(a.id) as count
                FROM ${destinations} d
                JOIN ${applications} a ON a.destination_id = d.id
                GROUP BY d.server_id
            ) app_counts ON app_counts.server_id = s.id
            LEFT JOIN (
                SELECT d.server_id, COUNT(db.id) as count
                FROM ${destinations} d
                JOIN ${databases} db ON db.destination_id = d.id
                GROUP BY d.server_id
            ) db_counts ON db_counts.server_id = s.id
            LEFT JOIN (
                SELECT server_id, COUNT(*) as count
                FROM ${quickDeployApps}
                GROUP BY server_id
            ) qd_counts ON qd_counts.server_id = s.id
            WHERE s.id = ${serverId} ${teamId ? sql`AND (s.team_id = ${teamId} OR (s.owner_type = 'team' AND s.owner_id = ${teamId}))` : sql``}
            LIMIT 1
        `;

        const result = await db.all(query);
        if (result.length === 0) return null;

        const row: any = result[0];
        return {
            ...row,
            application_count: Number(row.application_count),
            database_count: Number(row.database_count),
            tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
            healthCpu: row.health_cpu || 0,
            healthMemory: row.health_memory || 0,
            healthDisk: row.health_disk || 0,
            healthUpdatedAt: row.health_updated_at ? new Date(row.health_updated_at as string) : null,
            connectionType: row.connection_type,
            privateKeyId: row.private_key_id,
            vpsProviderId: row.vps_provider_id,
            agentChecksum: row.agent_checksum,
            agentVersion: row.agent_version,
            agentInstalledAt: row.agent_installed_at ? new Date(row.agent_installed_at as string) : null,
            cloudflareTunnelHostname: row.cloudflare_tunnel_hostname,
            cloudflareAccessTokenId: row.cloudflare_access_token_id,
            createdAt: new Date(row.created_at as string),
            updatedAt: new Date(row.updated_at as string),
            proxyType: row.proxy_type,
            proxyStatus: row.proxy_status,
            providerName: row.provider_name,
            providerType: row.provider_type
        };
	} catch (err: any) {
		throw err;
	}
}

/**
 * Create a new server
 * Supports company assignment via companyId parameter
 */
export async function createServer(data: NewServer & { companyId?: string | null }) {
	const { companyId, ...serverData } = data;
	
	// If companyId is provided, set ownerType and ownerId
	if (companyId) {
		serverData.ownerType = 'company';
		serverData.ownerId = companyId;
	}
	// If no companyId and no ownerType/ownerId, it will default to teamId (backward compatibility)
	
	const [server] = await db.insert(servers).values(serverData).returning();
	return server;
}

/**
 * Update a server
 * Supports both teamId (backward compatibility) and ownerType/ownerId model
 */
export async function updateServer(
	serverId: string,
	teamId: string | null | undefined,
	data: Partial<NewServer>
) {
    if (!teamId) {
        // God mode or direct ID access
        const [server] = await db
            .update(servers)
            .set({
                ...data,
                updatedAt: new Date()
            })
            .where(eq(servers.id, serverId))
            .returning();
        return server || null;
    }

	const [server] = await db
		.update(servers)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(
			and(
				eq(servers.id, serverId),
				or(
                    eq(servers.teamId, teamId),
                    and(eq(servers.ownerType, 'team'), eq(servers.ownerId, teamId))
                )
			)
		)
		.returning();

	return server || null;
}

/**
 * Delete a server
 * Supports both teamId (backward compatibility) and ownerType/ownerId model
 */
export async function deleteServer(serverId: string, teamId: string | null | undefined) {
	const [server] = await db
		.delete(servers)
		.where(
			and(
				eq(servers.id, serverId),
				teamId
					? or(
							eq(servers.teamId, teamId),
							and(eq(servers.ownerType, 'team'), eq(servers.ownerId, teamId))
						)
					: undefined
			)
		)
		.returning();

	return server || null;
}

/**
 * Validate server connection
 */
import { Client } from 'ssh2';
import { getPrivateKeyById } from './security';

/**
 * Validate server connection
 * Supports both teamId (backward compatibility) and ownerType/ownerId model
 */
export async function validateServerConnection(serverId: string, teamId: string | null | undefined) {
	const server = await getServerById(serverId, teamId);
	
	if (!server) {
		return { success: false, message: 'Server not found' };
	}

	if (!server.privateKeyId) {
		return { success: false, message: 'No private key associated with this server' };
	}

	const privateKey = await getPrivateKeyById(server.privateKeyId, teamId || null, !teamId);
	if (!privateKey) {
		return { success: false, message: 'Private key not found or access denied' };
	}

	if (server.connectionType === 'agent') {
		const { agentManager } = await import('../agent/manager');
		try {
			const result = await agentManager.executeCommandWithResult(server.id, 'uptime');
			if (result.success) {
				return { 
					success: true, 
					message: 'Agent connected and responsive', 
					details: { uptime: result.stdout.trim() } 
				};
			}
		} catch (error: any) {
			// Agent failed, fall through to SSH diagnostics
		}
	}

	return new Promise<{ success: boolean; message: string; details?: any }>(async (resolve) => {
		const conn = new Client();
		
		conn.on('ready', () => {
            // Check if we are validating an agent that failed
            if (server.connectionType === 'agent') {
                const cmd = `
                    echo "---PROCESS---";
                    pgrep -laf "agent.ts" || echo "Process not found";
                    
                    echo "---NETWORK---";
                    (ss -tupn | grep bun) || echo "No active connections";

                    echo "---SERVICE_STATUS---";
                    (systemctl status selfhost-agent --no-pager || rc-service selfhost-agent status) 2>&1;
                    
                    echo "--- LOGS (Last 50) ---";
                    (tail -n 50 /var/log/selfhost-agent.log 2>/dev/null || grep "selfhost-agent" /var/log/messages | tail -n 20 2>/dev/null || journalctl -u selfhost-agent -n 20 --no-pager 2>/dev/null) 2>&1;

                    echo "--- CONF ---";
                    (cat /etc/systemd/system/selfhost-agent.service || cat /etc/init.d/selfhost-agent) 2>&1;
                `;
                conn.exec(cmd, (err, stream) => {
                    if (err) {
                        conn.end();
                        return resolve({ success: false, message: 'Agent failed. SSH diagnostics failed.', details: { error: err.message } });
                    }
                    let output = '';
                    stream.on('close', () => {
                        conn.end();
                        // Naive parsing, but better than nothing
                        resolve({ 
                            success: false, 
                            message: 'Agent not connected.\n\nDIAGNOSTICS:\n' + output.substring(0, 5000), // Increased limit to see logs
                            details: { 
                                error: 'Agent Connection Failed',
                                raw_output: output 
                            }
                        });
                    }).on('data', (d: any) => output += d);
                });
                return;
            }

			conn.exec('uptime', (err, stream) => {
				if (err) {
					conn.end();
					return resolve({ success: true, message: 'Connection successful, but failed to execute command', details: { error: err.message } });
				}
				
				let output = '';
				stream.on('close', (code: any, signal: any) => {
					conn.end();
					resolve({ 
						success: true, 
						message: 'Connection successful',
						details: { 
							uptime: output.trim(),
							user: server.user,
							host: server.ip
						}
					});
				}).on('data', (data: any) => {
					output += data;
				}).stderr.on('data', (data: any) => {
					// output += data;
				});
			});
		}).on('error', (err) => {
			if (err.message.includes('All configured authentication methods failed')) {
				resolve({ success: false, message: 'SSH Authentication Failed: The private key was rejected by the server.' });
			} else {
				resolve({ success: false, message: `Connection failed: ${err.message}` });
			}
		}).connect({
			username: server.user,
			privateKey: privateKey.privateKey,
			readyTimeout: 10000,
			keepaliveInterval: 1000,
            ...(server.cloudflareTunnelHostname ? {
                sock: await (async () => {
                    const { CloudflareAccessService } = await import('./cloudflare-access');
                    const { Duplex } = await import('node:stream');

                    const proxy = await CloudflareAccessService.getSshProxyStream(
                        server.cloudflareTunnelHostname,
                        server.cloudflareAccessTokenId
                    );
                    
                    const duplex = new Duplex({
                        read(size) {},
                        write(chunk, encoding, callback) {
                            proxy.stdin.write(chunk, encoding, callback);
                        }
                    });

                    proxy.stdout.on('data', (chunk) => duplex.push(chunk));
                    proxy.stdout.on('end', () => duplex.push(null));
                    proxy.proc.on('error', (err) => duplex.emit('error', err));
                    proxy.proc.on('exit', (code) => {
                        if (code !== 0) duplex.emit('error', new Error(`cloudflared exited with code ${code}`));
                    });

                    conn.on('end', () => proxy.proc.kill());
                    conn.on('error', () => proxy.proc.kill());

                    return duplex;
                })()
            } : {
                host: server.ip,
                port: server.port,
            })
		});
	});
}
