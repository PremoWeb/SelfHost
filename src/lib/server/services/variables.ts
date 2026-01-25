import { db } from '../db/client';
import { sharedVariables } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { NewSharedVariable } from '../db/schema';

/**
 * Get all shared variables for a team
 */
export async function getSharedVariablesByTeam(teamId: string) {
	return db
		.select()
		.from(sharedVariables)
		.where(eq(sharedVariables.teamId, teamId))
		.orderBy(sharedVariables.key);
}

/**
 * Create a new shared variable
 */
export async function createSharedVariable(data: NewSharedVariable) {
	const [variable] = await db.insert(sharedVariables).values(data).returning();
	return variable;
}

/**
 * Update a shared variable
 */
export async function updateSharedVariable(
	variableId: string,
	teamId: string,
	data: Partial<NewSharedVariable>
) {
	const [variable] = await db
		.update(sharedVariables)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(and(eq(sharedVariables.id, variableId), eq(sharedVariables.teamId, teamId)))
		.returning();

	return variable || null;
}

/**
 * Delete a shared variable
 */
export async function deleteSharedVariable(variableId: string, teamId: string) {
	const [variable] = await db
		.delete(sharedVariables)
		.where(and(eq(sharedVariables.id, variableId), eq(sharedVariables.teamId, teamId)))
		.returning();

	return variable || null;
}
