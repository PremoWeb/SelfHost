import { db } from '../db/client';
import { environmentVariables } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { NewEnvironmentVariable } from '../db/schema';

/**
 * Get all environment variables for an application
 */
export async function getEnvironmentVariables(applicationId: string) {
	return db
		.select()
		.from(environmentVariables)
		.where(eq(environmentVariables.applicationId, applicationId))
		.orderBy(environmentVariables.key);
}

/**
 * Create a new environment variable
 */
export async function createEnvironmentVariable(data: NewEnvironmentVariable) {
	const [variable] = await db.insert(environmentVariables).values(data).returning();
	return variable;
}

/**
 * Update an environment variable
 */
export async function updateEnvironmentVariable(
	variableId: string,
	applicationId: string,
	data: Partial<NewEnvironmentVariable>
) {
	const [variable] = await db
		.update(environmentVariables)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(and(eq(environmentVariables.id, variableId), eq(environmentVariables.applicationId, applicationId)))
		.returning();

	return variable || null;
}

/**
 * Delete an environment variable
 */
export async function deleteEnvironmentVariable(variableId: string, applicationId: string) {
	const [variable] = await db
		.delete(environmentVariables)
		.where(and(eq(environmentVariables.id, variableId), eq(environmentVariables.applicationId, applicationId)))
		.returning();

	return variable || null;
}
