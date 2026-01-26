import { db } from '../db/client';
import { privateKeys, cloudflareAccessTokens } from '../db/schema';
import { eq, and, or } from 'drizzle-orm';
import type { NewPrivateKey } from '../db/schema';
import { createPrivateKey as createCryptoKey } from 'node:crypto';

/**
 * Get all Cloudflare Access Tokens for a team
 */
export async function getCloudflareAccessTokensByTeam(teamId: string | null | undefined, isGod: boolean = false) {
    if (isGod) {
        return db
            .select()
            .from(cloudflareAccessTokens)
            .orderBy(cloudflareAccessTokens.createdAt);
    }

    if (!teamId) return [];

	return db
		.select()
		.from(cloudflareAccessTokens)
		.where(
            or(
                eq(cloudflareAccessTokens.teamId, teamId),
                and(eq(cloudflareAccessTokens.ownerType, 'team'), eq(cloudflareAccessTokens.ownerId, teamId))
            )
        )
		.orderBy(cloudflareAccessTokens.createdAt);
}

/**
 * Get Cloudflare Access Tokens by owner (polymorphic)
 */
export async function getCloudflareAccessTokensByOwner(ownerType: string, ownerId: string) {
    return db
        .select()
        .from(cloudflareAccessTokens)
        .where(
            and(
                eq(cloudflareAccessTokens.ownerType, ownerType),
                eq(cloudflareAccessTokens.ownerId, ownerId)
            )
        )
        .orderBy(cloudflareAccessTokens.createdAt);
}

/**
 * Helper to derive public key from private key
 */
import { writeFileSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import ssh2 from 'ssh2';
const { Client, utils: sshutils } = ssh2;
import { getServerById, updateServer } from './servers';

/**
 * Helper to derive public key from private key
 */

function derivePublicKey(privateKeyPem: string): string | null {
    try {
        const parsed = sshutils.parseKey(privateKeyPem);
        if (parsed instanceof Error) {
            console.error('Failed to parse SSH key:', parsed.message);
            return null;
        }

        if (typeof parsed.getPublicSSH !== 'function') {
            // For some key types, ssh2 might not have getPublicSSH on the object directly
            // or it might be a different structure depending on the version/type.
            // But for RSA/ED25519/ECDSA it usually exists.
            return null;
        }

        const publicSSH = parsed.getPublicSSH();
        return `${parsed.type} ${publicSSH.toString('base64')}`;
    } catch (e) {
        console.error('Error deriving public key:', e);
        return null;
    }
}

/**
 * Get all private keys for a team or user
 */
export async function getPrivateKeysByTeam(teamId: string | null | undefined, isGod: boolean = false) {
    if (isGod) {
        return db
            .select()
            .from(privateKeys)
            .orderBy(privateKeys.createdAt);
    }

    if (!teamId) return [];

	return db
		.select()
		.from(privateKeys)
		.where(
            or(
                eq(privateKeys.teamId, teamId),
                and(eq(privateKeys.ownerType, 'team'), eq(privateKeys.ownerId, teamId))
            )
        )
		.orderBy(privateKeys.createdAt);
}

/**
 * Get private keys by owner (polymorphic)
 */
export async function getPrivateKeysByOwner(ownerType: string, ownerId: string) {
    return db
        .select()
        .from(privateKeys)
        .where(
            and(
                eq(privateKeys.ownerType, ownerType),
                eq(privateKeys.ownerId, ownerId)
            )
        )
        .orderBy(privateKeys.createdAt);
}

/**
 * Get private key by ID
 * Supports company ownership and God users
 */
export async function getPrivateKeyById(keyId: string, teamId: string | null, isGod: boolean = false) {
	const [key] = await db
		.select()
		.from(privateKeys)
		.where(eq(privateKeys.id, keyId))
		.limit(1);

	if (!key) {
		return null;
	}

	// God users can access any key
	if (isGod) {
		return {
			...key,
			publicKey: derivePublicKey(key.privateKey)
		};
	}

	// Check if key belongs to the team (backward compatibility)
	if (teamId && key.teamId === teamId) {
		return {
			...key,
			publicKey: derivePublicKey(key.privateKey)
		};
	}

	// Check if key belongs to a company the user has access to
	// TODO: Add company membership check here if needed

	return null;
}

/**
 * Create a new private key
 * Supports company assignment via companyId parameter
 */
export async function createPrivateKey(data: NewPrivateKey & { companyId?: string | null }) {
	const { companyId, ...keyData } = data;
	
	// If companyId is provided, set ownerType and ownerId
	if (companyId) {
		keyData.ownerType = 'company';
		keyData.ownerId = companyId;
	}
	// If no companyId and no ownerType/ownerId, it will default to teamId (backward compatibility)
	
	const [key] = await db.insert(privateKeys).values(keyData).returning();
	return key;
}

/**
 * Update a private key
 * Supports company ownership and God users
 */
export async function updatePrivateKey(
	keyId: string,
	teamId: string | null,
	isGod: boolean,
	data: Partial<NewPrivateKey>
) {
	// First verify access
	const existingKey = await getPrivateKeyById(keyId, teamId, isGod);
	if (!existingKey) {
		return null;
	}

	const [key] = await db
		.update(privateKeys)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(eq(privateKeys.id, keyId))
		.returning();

    if (key) {
        return {
            ...key,
            publicKey: derivePublicKey(key.privateKey)
        };
    }

	return null;
}

/**
 * Delete a private key
 * Supports company ownership and God users
 */
export async function deletePrivateKey(keyId: string, teamId: string | null, isGod: boolean = false) {
	// First check if user has access
	const key = await getPrivateKeyById(keyId, teamId, isGod);
	if (!key) return null;

	const [deletedKey] = await db
		.delete(privateKeys)
		.where(eq(privateKeys.id, keyId))
		.returning();

	return deletedKey;
}

/**
 * Generate a new SSH Key Pair (RSA 4096)
 */
import { generateKeyPairSync } from 'node:crypto';

export function generateKeyPair() {
	const { privateKey, publicKey: publicKeyPem } = generateKeyPairSync('rsa' as any, {
		modulusLength: 4096,
		publicKeyEncoding: {
            type: 'pkcs1',
			format: 'pem'
		},
		privateKeyEncoding: {
			type: 'pkcs1',
			format: 'pem'
		}
	} as any);

    const publicKey = derivePublicKey(privateKey.toString());

	return {
		privateKey: privateKey.toString(),
		publicKey: publicKey || publicKeyPem.toString()
	};
}


/**
 * Install a private key on a remote server using a password
 */
export async function installPrivateKeyViaPassword({
    serverId,
    teamId,
    password,
    keyId,
    userId // Added userId for God mode ownership
}: {
    serverId: string;
    teamId?: string | null;
    password: string;
    keyId?: string;
    userId?: string;
}) {
    const server = await getServerById(serverId, teamId);
    if (!server) throw new Error('Server not found');

    let privateKeyRecord;
    if (keyId) {
        privateKeyRecord = await getPrivateKeyById(keyId, teamId ?? null, true); // Use isGod = true to ensure we find it
        if (!privateKeyRecord) throw new Error('Private key not found');
    } else {
        // Generate a new key if none provided
        const { privateKey, publicKey } = generateKeyPair();
        
        // Determine ownership
        const ownerType = teamId ? 'team' : 'individual';
        const ownerId = teamId || userId;
        
        if (!ownerId && !teamId) {
            throw new Error('Could not determine ownership for new key (missing team and user ID)');
        }

        privateKeyRecord = await createPrivateKey({
            name: `Auto-generated for ${server.name}`,
            privateKey,
            teamId: teamId || null,
            ownerType,
            ownerId
        });
        // We'll need the public key for installation
        (privateKeyRecord as any).publicKey = publicKey;
    }

    // Ensure we have the OpenSSH formatted public key
    const publicKey = ((privateKeyRecord as any).publicKey || derivePublicKey(privateKeyRecord.privateKey)) as string;
    if (!publicKey) throw new Error('Could not derive public key');

    // Set up connection options (like testConnection does)
    const conn = new Client();
    
    let connectOptions: any = {
        username: server.user || 'root',
        password: password,
        readyTimeout: server.cloudflareTunnelHostname ? 10000 : 10000,
        keepaliveInterval: 1000,
        tryKeyboard: true
    };

    let proxy: any = undefined;

    if (server.cloudflareTunnelHostname) {
        // When using a socket (Cloudflare tunnel), don't set host/port
        // The socket stream handles the connection
        const { CloudflareAccessService } = await import('./cloudflare-access');
        const { Duplex } = await import('node:stream');

        console.log(`[SSH] Initializing Cloudflare Tunnel connection to ${server.cloudflareTunnelHostname}`);

        proxy = await CloudflareAccessService.getSshProxyStream(
            server.cloudflareTunnelHostname,
            server.cloudflareAccessTokenId
        );
        
        let cloudflaredErrors: string[] = [];
        
        const duplex = new Duplex({
            read() {},
            write(chunk, encoding, callback) { 
                proxy.stdin.write(chunk, encoding, callback); 
            }
        });
        
        proxy.stdout.on('data', (c: Buffer) => duplex.push(c));
        proxy.stdout.on('end', () => duplex.push(null));
        
        // Capture stderr from cloudflared for debugging and error reporting
        if (proxy.stderr) {
            proxy.stderr.on('data', (data: Buffer) => {
                const errorMsg = data.toString();
                cloudflaredErrors.push(errorMsg);
                console.error(`[cloudflared stderr] ${errorMsg.trim()}`);
            });
        }
        
        proxy.proc.on('error', (e: Error) => {
            const errorMsg = `cloudflared process error: ${e.message}`;
            cloudflaredErrors.push(errorMsg);
            console.error(`[cloudflared] Process error: ${e.message}`);
            duplex.emit('error', e);
        });
        
        proxy.proc.on('exit', (code: number, signal: string | null) => {
            if (code !== 0) {
                const errorMsg = `cloudflared exited with code ${code}${cloudflaredErrors.length > 0 ? ': ' + cloudflaredErrors.join(' ') : ''}`;
                console.error(`[cloudflared] ${errorMsg}`);
                duplex.emit('error', new Error(errorMsg));
            }
        });
        
        connectOptions.sock = duplex;
    } else {
        // Direct connection - set host and port
        if (!server.ip) throw new Error('IP Address required for direct connection');
        connectOptions.host = server.ip;
        connectOptions.port = server.port || 22;
    }

    return new Promise((resolve, reject) => {
        let isDone = false;
        let timeoutCleared = false;
        let cloudflaredErrorTimeout: NodeJS.Timeout | null = null;

        const cleanup = (error?: Error) => {
            if (cloudflaredErrorTimeout) clearTimeout(cloudflaredErrorTimeout);
            if (isDone) return;
            isDone = true;
            conn.end();
            if (proxy) proxy.proc.kill();
            if (error) reject(error);
        };

        // Set up cleanup handlers for proxy (like testConnection does)
        if (proxy) {
            conn.on('end', () => proxy.proc.kill());
        }

        // Set up error handler FIRST (before ready handlers)
        conn.on('error', (err: Error) => {
            console.error('[installPrivateKeyViaPassword] Connection error:', err.message);
            if (isDone) return;
            if (proxy) proxy.proc.kill();
            cleanup(new Error(`Connection failed: ${err.message}`));
        });

        // Set up keyboard-interactive handler
        conn.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
            console.log('[installPrivateKeyViaPassword] Keyboard-interactive prompt');
            // Auto-respond with password for any prompt
            if (prompts.length > 0) {
                 finish([password]);
            } else {
                 finish([]);
            }
        });

        // Set up the main ready handler that does the work
        conn.on('ready', () => {
            console.log('[installPrivateKeyViaPassword] ===== CONNECTION READY EVENT FIRED =====');
            
            // Clear timeout if not already cleared
            if (!timeoutCleared && cloudflaredErrorTimeout) {
                timeoutCleared = true;
                console.log('[installPrivateKeyViaPassword] Clearing timeout in ready handler...');
                clearTimeout(cloudflaredErrorTimeout);
            }

            // Use a safer way to append to authorized_keys that handles newlines
            const command = `mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && grep -qF "${publicKey}" ~/.ssh/authorized_keys || echo "${publicKey}" >> ~/.ssh/authorized_keys`;
            console.log('[installPrivateKeyViaPassword] Executing key installation command...');
            
            conn.exec(command, (err, stream) => {
                if (err) {
                    console.error('[installPrivateKeyViaPassword] Exec error:', err);
                    return cleanup(err);
                }
                
                console.log('[installPrivateKeyViaPassword] Key installation stream created');
                
                // CRITICAL: We must read from the stream or it will hang!
                let output = '';
                stream.on('data', (data: Buffer) => {
                    const text = data.toString();
                    output += text;
                    console.log(`[installPrivateKeyViaPassword] Stream stdout: ${text.trim()}`);
                });
                
                stream.stderr.on('data', (data: Buffer) => {
                    const text = data.toString();
                    console.error(`[installPrivateKeyViaPassword] Stream stderr: ${text.trim()}`);
                });
                
                stream.on('close', async (code: number) => {
                    console.log(`[installPrivateKeyViaPassword] Command exited with code ${code}`);
                    if (output) console.log(`[installPrivateKeyViaPassword] Full output: ${output}`);
                    
                    if (code === 0) {
                        try {
                            console.log('[installPrivateKeyViaPassword] Updating server record with privateKeyId...');
                            const updated = await updateServer(serverId, teamId, { privateKeyId: privateKeyRecord.id });
                            
                            isDone = true;
                            conn.end();
                            if (proxy) proxy.proc.kill();
                            console.log('[installPrivateKeyViaPassword] Key installation completed successfully');
                            resolve({ 
                                success: true, 
                                message: 'Key installed successfully',
                                privateKeyId: privateKeyRecord.id,
                                keyId: privateKeyRecord.id // alias for backward compat if needed
                            });
                        } catch (updateErr) {
                            console.error('[installPrivateKeyViaPassword] Update server error:', updateErr);
                            cleanup(updateErr instanceof Error ? updateErr : new Error(String(updateErr)));
                        }
                    } else {
                        cleanup(new Error(`Failed to install key. Exit code: ${code}${output ? `. Output: ${output}` : ''}`));
                    }
                });
            });
        });

        // Set a timeout for tunnel connections (AFTER handlers are set up, like the test script)
        if (server.cloudflareTunnelHostname) {
            cloudflaredErrorTimeout = setTimeout(() => {
                if (!isDone && !timeoutCleared) {
                    console.error('[installPrivateKeyViaPassword] ===== CONNECTION TIMEOUT FIRED =====');
                    console.error(`[installPrivateKeyViaPassword] timeoutCleared: ${timeoutCleared}`);
                    console.error(`[installPrivateKeyViaPassword] isDone: ${isDone}`);
                    isDone = true;
                    conn.end();
                    if (proxy) proxy.proc.kill();
                    reject(new Error(`Connection timeout after 10 seconds. Verify that:\n1. The Cloudflare Access application for ${server.cloudflareTunnelHostname} is configured correctly\n2. The SSH service is running on port ${server.port || 22} behind the tunnel\n3. The tunnel is active and connected`));
                }
            }, 10000);
        }

        console.log('[installPrivateKeyViaPassword] Calling connect...');
        conn.connect(connectOptions);
    });
}
