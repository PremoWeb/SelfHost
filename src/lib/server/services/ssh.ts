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
	teamId: string | null, 
	command: string
): Promise<CommandResult> {
	const server = await getServerById(serverId, teamId);
	
	if (!server) {
		throw new Error('Server not found');
	}

	if (!server.privateKeyId) {
		throw new Error('No private key associated with this server');
	}

	// Allow god users to access private keys without team context
	const userIsGod = teamId === null;
	const privateKey = await getPrivateKeyById(server.privateKeyId, teamId, userIsGod);
	if (!privateKey) {
		throw new Error('Private key not found or access denied');
	}

	const conn = new Client();
	
	let connectOptions: any = {
		username: server.user,
		privateKey: privateKey.privateKey,
		readyTimeout: 10000,
		keepaliveInterval: 1000,
	};

	if (server.cloudflareTunnelHostname) {
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

		connectOptions.sock = duplex;
	} else {
		connectOptions.host = server.ip;
		connectOptions.port = server.port;
	}

	return new Promise<CommandResult>((resolve, reject) => {
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
		}).connect(connectOptions);
	});

}

/**
 * Test SSH Connection given credentials directly
 */
export async function testConnection({
	ip,
	port,
	user,
	password,
	privateKeyId,
    teamId,
	cloudflareTunnelHostname,
	cloudflareAccessTokenId
}: {
	ip?: string;
	port: number;
	user: string;
	password?: string;
	privateKeyId?: string;
    teamId?: string | null;
	cloudflareTunnelHostname?: string | null;
	cloudflareAccessTokenId?: string | null;
}): Promise<{ success: boolean; message: string }> {
	const conn = new Client();
	
	let connectOptions: any = {
		username: user,
		readyTimeout: 10000, // Increased timeout for tunnel connections
		tryKeyboard: true // Important for password auth
	};

	if (password) {
		connectOptions.password = password;
	} else if (privateKeyId) {
        // If privateKeyId is provided, fetch it
        // Note: We might need to handle 'null' teamId if using god mode or personal checks
        const privateKey = await getPrivateKeyById(privateKeyId, teamId || null, !teamId); // If no teamId, safely assume maybe God mode or check fails later
		if (!privateKey) throw new Error('Private key not found');
		connectOptions.privateKey = privateKey.privateKey;
	} else {
		throw new Error('No password or private key provided');
	}

	if (cloudflareTunnelHostname) {
		// When using a socket (Cloudflare tunnel), don't set host/port
		// The socket stream handles the connection
		const proxy = await CloudflareAccessService.getSshProxyStream(
			cloudflareTunnelHostname,
			cloudflareAccessTokenId ?? null
		);
		
		let cloudflaredErrors: string[] = [];
		
		const duplex = new Duplex({
			read() {},
			write(chunk, encoding, callback) { 
				proxy.stdin.write(chunk, encoding, callback); 
			}
		});
		
		proxy.stdout.on('data', (c) => duplex.push(c));
		proxy.stdout.on('end', () => duplex.push(null));
        
        // Capture stderr from cloudflared for debugging and error reporting
        if (proxy.stderr) {
            proxy.stderr.on('data', (data) => {
                const errorMsg = data.toString();
                cloudflaredErrors.push(errorMsg);
                console.error(`[cloudflared stderr] ${errorMsg.trim()}`);
            });
        }
        
		proxy.proc.on('error', (e) => {
			const errorMsg = `cloudflared process error: ${e.message}`;
			cloudflaredErrors.push(errorMsg);
			console.error(`[cloudflared] Process error: ${e.message}`);
			duplex.emit('error', e);
		});
		
        proxy.proc.on('exit', (code, signal) => {
            if (code !== 0) {
                const errorMsg = `cloudflared exited with code ${code}${cloudflaredErrors.length > 0 ? ': ' + cloudflaredErrors.join(' ') : ''}`;
                console.error(`[cloudflared] ${errorMsg}`);
                duplex.emit('error', new Error(errorMsg));
            }
        });
		
		conn.on('end', () => proxy.proc.kill());
		conn.on('error', (err) => {
			console.error(`[SSH] Connection error: ${err.message}`);
			proxy.proc.kill();
		});
		
		connectOptions.sock = duplex;
	} else {
        // Direct connection - set host and port
        if (!ip) throw new Error('IP Address required for direct connection');
		connectOptions.host = ip;
		connectOptions.port = port;
	}

	return new Promise((resolve) => {
		let resolved = false;
		let cloudflaredErrorTimeout: NodeJS.Timeout | null = null;
		
		// Set a timeout for tunnel connections
		if (cloudflareTunnelHostname) {
			cloudflaredErrorTimeout = setTimeout(() => {
				if (!resolved) {
					resolved = true;
					conn.end();
					resolve({ 
						success: false, 
						message: `Connection timeout after 15 seconds. Verify that:\n1. The Cloudflare Access application for ${cloudflareTunnelHostname} is configured correctly\n2. The SSH service is running on port ${port} behind the tunnel\n3. The tunnel is active and connected\n4. Service token credentials are valid (if using a token)` 
					});
				}
			}, 15000);
		}
		
		const cleanup = () => {
			if (cloudflaredErrorTimeout) clearTimeout(cloudflaredErrorTimeout);
			resolved = true;
		};
		
		conn.on('ready', () => {
			cleanup();
			conn.end();
			resolve({ success: true, message: 'Connection established successfully' });
		})
		.on('error', (err) => {
			if (resolved) return;
			cleanup();
			// Include more context for tunnel errors
			if (cloudflareTunnelHostname) {
				let message = err.message;
				if (err.message.includes('cloudflared') || err.message.includes('ECONNREFUSED') || err.message.includes('timeout')) {
					message = `Cloudflare tunnel connection failed: ${err.message}\n\nTroubleshooting:\n- Verify ${cloudflareTunnelHostname} is configured in Cloudflare Access\n- Check that the SSH service is running on port ${port} behind the tunnel\n- Ensure the tunnel is active: cloudflared tunnel list\n- Verify service token credentials (if using authentication)`;
				}
				resolve({ success: false, message });
			} else {
				resolve({ success: false, message: err.message });
			}
		})
		.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
			// Auto-respond with password if prompted
			if (prompts.length > 0 && password) {
				finish([password]);
			} else {
				finish([]);
			}
		})
		.connect(connectOptions);
	});
}
