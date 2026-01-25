import { db } from '$lib/server/db';
import { vpsTemplates } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { NewVpsTemplate } from '$lib/server/db/schema';

/**
 * Get all VPS templates for a team and provider
 */
export async function getVpsTemplates(teamId: string | null | undefined, vpsProviderId: string) {
    if (!teamId) return [];
	return await db
		.select()
		.from(vpsTemplates)
		.where(and(
			eq(vpsTemplates.teamId, teamId),
			eq(vpsTemplates.vpsProviderId, vpsProviderId)
		));
}

/**
 * Get a VPS template by ID
 */
export async function getVpsTemplateById(id: string, teamId: string) {
	const results = await db
		.select()
		.from(vpsTemplates)
		.where(and(
			eq(vpsTemplates.id, id),
			eq(vpsTemplates.teamId, teamId)
		))
		.limit(1);
	
	return results[0] || null;
}

/**
 * Create a new VPS template
 */
export async function createVpsTemplate(data: NewVpsTemplate) {
	const results = await db
		.insert(vpsTemplates)
		.values(data)
		.returning();
	
	return results[0];
}

/**
 * Delete a VPS template
 */
export async function deleteVpsTemplate(id: string, teamId: string) {
	await db
		.delete(vpsTemplates)
		.where(and(
			eq(vpsTemplates.id, id),
			eq(vpsTemplates.teamId, teamId)
		));
}
