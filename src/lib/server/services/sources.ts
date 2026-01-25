import { db } from '../db/client';
import { sources } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { NewSource } from '../db/schema';

/**
 * Get all sources for a team
 */
export async function getSourcesByTeam(teamId: string) {
	return db
		.select()
		.from(sources)
		.where(eq(sources.teamId, teamId))
		.orderBy(sources.createdAt);
}

/**
 * Get source by ID
 */
export async function getSourceById(sourceId: string, teamId: string) {
	const [source] = await db
		.select()
		.from(sources)
		.where(eq(sources.id, sourceId))
		.limit(1);

	// Basic security check
	if (source && source.teamId !== teamId) {
		return null;
	}

	return source || null;
}

/**
 * Create a new source
 */
export async function createSource(data: NewSource) {
	const [source] = await db.insert(sources).values(data).returning();
	return source;
}

/**
 * Update a source
 */
export async function updateSource(
	sourceId: string,
	teamId: string,
	data: Partial<NewSource>
) {
	const [source] = await db
		.update(sources)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(eq(sources.id, sourceId))
		.returning();

	if (source && source.teamId !== teamId) {
		return null;
	}

	return source || null;
}

/**
 * Delete a source
 */
export async function deleteSource(sourceId: string, teamId: string) {
	const source = await getSourceById(sourceId, teamId);
	if (!source) return null;

	const [deletedSource] = await db
		.delete(sources)
		.where(eq(sources.id, sourceId))
		.returning();

	return deletedSource;
}
