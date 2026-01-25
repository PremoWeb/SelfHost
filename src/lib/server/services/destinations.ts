import { db } from '../db/client';
import { destinations, servers } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { NewDestination } from '../db/schema';

/**
 * Get all destinations for a team
 */
export async function getDestinationsByTeam(teamId: string) {
	return db
		.select({
			id: destinations.id,
			name: destinations.name,
			description: destinations.description,
			type: destinations.type,
			network: destinations.network,
			serverId: destinations.serverId,
			serverName: servers.name,
			createdAt: destinations.createdAt
		})
		.from(destinations)
		.innerJoin(servers, eq(destinations.serverId, servers.id))
		.where(eq(destinations.teamId, teamId))
		.orderBy(destinations.createdAt);
}

/**
 * Get destination by ID
 */
export async function getDestinationById(destId: string, teamId: string) {
	const [dest] = await db
		.select({
			id: destinations.id,
			name: destinations.name,
			description: destinations.description,
			type: destinations.type,
			network: destinations.network,
			serverId: destinations.serverId,
			serverName: servers.name,
			teamId: destinations.teamId,
			ownerType: destinations.ownerType,
			ownerId: destinations.ownerId,
			createdAt: destinations.createdAt,
			updatedAt: destinations.updatedAt
		})
		.from(destinations)
		.innerJoin(servers, eq(destinations.serverId, servers.id))
		.where(and(eq(destinations.id, destId), eq(destinations.teamId, teamId)))
		.limit(1);

	return dest || null;
}

/**
 * Create a new destination
 */
export async function createDestination(data: NewDestination) {
	const [dest] = await db.insert(destinations).values(data).returning();
	return dest;
}

/**
 * Update a destination
 */
export async function updateDestination(
	destId: string,
	teamId: string,
	data: Partial<NewDestination>
) {
	const [dest] = await db
		.update(destinations)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(and(eq(destinations.id, destId), eq(destinations.teamId, teamId)))
		.returning();

	return dest || null;
}

/**
 * Delete a destination
 */
export async function deleteDestination(destId: string, teamId: string) {
	const [dest] = await db
		.delete(destinations)
		.where(and(eq(destinations.id, destId), eq(destinations.teamId, teamId)))
		.returning();

	return dest || null;
}
