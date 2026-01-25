import { db } from '../db/client';
import { privateKeys } from '../db/schema';
import { eq, and, or } from 'drizzle-orm';
import type { NewPrivateKey } from '../db/schema';
import { createPrivateKey as createCryptoKey } from 'node:crypto';

/**
 * Helper to derive public key from private key
 */
import { writeFileSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import ssh2 from 'ssh2';
const { Client: SSH2Client, utils: sshutils } = ssh2;
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
        privateKeyRecord = await getPrivateKeyById(keyId, teamId, true); // Use isGod = true to ensure we find it
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

    return new Promise((resolve, reject) => {
        const conn = new SSH2Client();
        let isDone = false;

        const cleanup = (error?: Error) => {
            if (isDone) return;
            isDone = true;
            conn.end();
            if (error) reject(error);
        };

        conn.on('ready', () => {
            // Use a safer way to append to authorized_keys that handles newlines
            const command = `mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && grep -qF "${publicKey}" ~/.ssh/authorized_keys || echo "${publicKey}" >> ~/.ssh/authorized_keys`;
            
            conn.exec(command, (err, stream) => {
                if (err) {
                    return cleanup(err);
                }
                
                stream.on('close', async (code: number) => {
                    if (code === 0) {
                        try {
                            const updated = await updateServer(serverId, teamId, { privateKeyId: privateKeyRecord.id });
                            
                            isDone = true;
                            conn.end();
                            resolve({ 
                                success: true, 
                                message: 'Key installed successfully',
                                privateKeyId: privateKeyRecord.id,
                                keyId: privateKeyRecord.id // alias for backward compat if needed
                            });
                        } catch (updateErr) {
                            cleanup(updateErr instanceof Error ? updateErr : new Error(String(updateErr)));
                        }
                    } else {
                        cleanup(new Error(`Failed to install key. Exit code: ${code}`));
                    }
                });
            });
        }).on('error', (err: Error) => {
            cleanup(new Error(`Connection failed: ${err.message}`));
        }).on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
            // Auto-respond with password for any prompt
            if (prompts.length > 0) {
                 finish([password]);
            } else {
                 finish([]);
            }
        }).connect((() => {
            const connectOptions: any = {
                username: server.user || 'root',
                password: password,
                readyTimeout: 10000,
                keepaliveInterval: 1000,
                tryKeyboard: true
            };

            if (server.cloudflareTunnelHostname) {
                connectOptions.sock = (async () => {
                    const { CloudflareAccessService } = await import('./cloudflare-access');
                    const { Duplex } = await import('node:stream');

                    const proxy = await CloudflareAccessService.getSshProxyStream(
                        server.cloudflareTunnelHostname,
                        server.cloudflareAccessTokenId
                    );
                    
                    const duplex = new Duplex({
                        read() {},
                        write(chunk, encoding, callback) {
                            proxy.stdin.write(chunk, encoding, callback);
                        }
                    });

                    proxy.stdout.on('data', (chunk: Buffer) => duplex.push(chunk));
                    proxy.stdout.on('end', () => duplex.push(null));
                    proxy.proc.on('error', (err: Error) => duplex.emit('error', err));
                    proxy.proc.on('exit', (code: number) => {
                        if (code !== 0) duplex.emit('error', new Error(`cloudflared exited with code ${code}`));
                    });

                    conn.on('end', () => proxy.proc.kill());
                    conn.on('error', () => proxy.proc.kill());

                    return duplex;
                })();
            } else {
                connectOptions.host = server.ip;
                connectOptions.port = server.port || 22;
            }
            return connectOptions;
        })());

        // Global timeout as a safety net
        setTimeout(() => {
            if (!isDone) {
                cleanup(new Error('Installation timed out after 20 seconds'));
            }
        }, 20000);
    });
}
