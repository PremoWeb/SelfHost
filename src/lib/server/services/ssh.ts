import { Client } from 'ssh2';
import { getServerById } from './servers';
import { getPrivateKeyById } from './security';
import { CloudflareAccessService } from './cloudflare-access';
import { Duplex } from 'node:stream';

interface CommandResult {
	success: boolean;
	stdout: string;
	stderr: string;
	code: number | null;
	signal: string | null;
}

/**
 * Execute a command on a remote server via SSH
 */
export async function executeCommand(
	serverId: string, 
	teamId: string, 
	command: string
): Promise<CommandResult> {
	const server = await getServerById(serverId, teamId);
	
	if (!server) {
		throw new Error('Server not found');
	}

	if (!server.privateKeyId) {
		throw new Error('No private key associated with this server');
	}

	const privateKey = await getPrivateKeyById(server.privateKeyId, teamId || null, false);
	if (!privateKey) {
		throw new Error('Private key not found or access denied');
	}

	return new Promise<CommandResult>((resolve, reject) => {
		const conn = new Client();
		
		conn.on('ready', () => {
			conn.exec(command, (err, stream) => {
				if (err) {
					conn.end();
					return reject(err);
				}
				
				let stdout = '';
				let stderr = '';

				stream.on('close', (code: any, signal: any) => {
					conn.end();
					resolve({ 
						success: code === 0, 
						stdout, 
						stderr,
						code,
						signal
					});
				}).on('data', (data: any) => {
					stdout += data;
				}).stderr.on('data', (data: any) => {
					stderr += data;
				});
			});
		}).on('error', (err) => {
			reject(new Error(`Connection failed: ${err.message}`));
		}).connect({
			username: server.user,
			privateKey: privateKey.privateKey,
			readyTimeout: 10000,
			keepaliveInterval: 1000,
			...(server.cloudflareTunnelHostname
				? {
						sock: await (async () => {
							const proxy = await CloudflareAccessService.getSshProxyStream(
								server.cloudflareTunnelHostname,
								server.cloudflareAccessTokenId
							);

							// Create a Duplex stream from the process
							const duplex = new Duplex({
								read(size) {
									// Data is pushed from stdout
								},
								write(chunk, encoding, callback) {
									proxy.stdin.write(chunk, encoding, callback);
								}
							});

							proxy.stdout.on('data', (chunk) => {
								duplex.push(chunk);
							});

							proxy.stdout.on('end', () => {
								duplex.push(null);
							});

							proxy.proc.on('error', (err) => {
								duplex.emit('error', err);
							});

							proxy.proc.on('exit', (code) => {
								if (code !== 0) {
									duplex.emit('error', new Error(`cloudflared exited with code ${code}`));
								}
							});

							// Handle cleanup
							conn.on('end', () => proxy.proc.kill());
							conn.on('error', () => proxy.proc.kill());

							return duplex;
						})()
					}
				: {
						host: server.ip,
						port: server.port
					})
		});
	});
}
