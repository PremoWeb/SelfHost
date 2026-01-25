import { db } from '../db/client';
import { privateKeys } from '../db/schema';
import { eq } from 'drizzle-orm';
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

/**
 * Helper to derive public key from private key
 */
function derivePublicKey(privateKeyPem: string): string | null {
    // 1. Try node:crypto first (fastest)
    try {
        const key = createCryptoKey(privateKeyPem);
         return (key.export({
             format: 'openssh',
             type: 'pkcs1' 
         } as any)).toString();
    } catch (e) {
    }

    // 2. Fallback to ssh-keygen (most robust on Linux)
    try {
        // Create a unique temp file
        const tempId = randomBytes(16).toString('hex');
        const tempFilePath = join(tmpdir(), `temp-key-${tempId}`);
        
        // Ensure the private key ends with a newline to avoid some aggressive ssh-keygen parsing issues
        const content = privateKeyPem.trim() + '\n';
        
        // Write private key to temp file
        // Set mode to 600 (owner read/write only) as ssh-keygen often requires strict permissions
        writeFileSync(tempFilePath, content, { mode: 0o600 });
        
        try {
            // Run ssh-keygen -y -f <file>
            // -y: Read private key file and print public key
            const publicKey = execSync(`ssh-keygen -y -f "${tempFilePath}"`, { 
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
            });
            
            return publicKey.trim();
        } finally {
            // Always clean up temp file
            try {
                unlinkSync(tempFilePath);
            } catch (cleanupErr) {
            }
        }
    } catch (fallbackErr) {
        return null;
    }
}

/**
 * Get all private keys for a team
 */
export async function getPrivateKeysByTeam(teamId: string | null | undefined) {
    if (!teamId) return [];
	return db
		.select()
		.from(privateKeys)
		.where(eq(privateKeys.teamId, teamId))
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
	const { privateKey, publicKey } = generateKeyPairSync('rsa', {
		modulusLength: 4096,
		publicKeyEncoding: {
			type: 'pkcs1',
			format: 'pem'
		},
		privateKeyEncoding: {
			type: 'pkcs1',
			format: 'pem'
		}
	});

	return {
		privateKey,
		publicKey
	};
}
