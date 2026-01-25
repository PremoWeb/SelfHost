import { db } from '../db/client';
import { apiTokens } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { NewApiToken } from '../db/schema';

/**
 * Get all API tokens for a team
 */
export async function getApiTokensByTeam(teamId: string) {
	return db
		.select()
		.from(apiTokens)
		.where(eq(apiTokens.teamId, teamId))
		.orderBy(apiTokens.createdAt);
}

/**
 * Get API token by ID
 */
export async function getApiTokenById(tokenId: string, teamId: string) {
	const [token] = await db
		.select()
		.from(apiTokens)
		.where(and(eq(apiTokens.id, tokenId), eq(apiTokens.teamId, teamId)))
		.limit(1);

	return token || null;
}

/**
 * Create a new API token
 * Supports company assignment via companyId parameter
 */
export async function createApiToken(data: NewApiToken & { companyId?: string | null }) {
	const { companyId, ...tokenData } = data;
	
	// If companyId is provided, set ownerType and ownerId
	if (companyId) {
		tokenData.ownerType = 'company';
		tokenData.ownerId = companyId;
	}
	// If no companyId and no ownerType/ownerId, it will default to teamId (backward compatibility)
	
	const [token] = await db.insert(apiTokens).values(tokenData).returning();
	return token;
}

/**
 * Delete an API token
 */
export async function deleteApiToken(tokenId: string, teamId: string) {
	const [token] = await db
		.delete(apiTokens)
		.where(and(eq(apiTokens.id, tokenId), eq(apiTokens.teamId, teamId)))
		.returning();

	return token || null;
}
