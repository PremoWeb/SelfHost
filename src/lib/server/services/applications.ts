import { db } from '../db/client';
import { applications } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { NewApplication } from '../db/schema';

/**
 * Get all applications for an environment
 */
export async function getApplicationsByEnvironment(environmentId: string) {
	return db
		.select()
		.from(applications)
		.where(eq(applications.environmentId, environmentId))
		.orderBy(applications.createdAt);
}

/**
 * Get application by ID
 */
export async function getApplicationById(appId: string) {
	// In a real app we might want to verify team ownership here by joining tables,
	// but for now we'll trust the upper layers to handle authorization via environment/project checks.
	const [app] = await db
		.select()
		.from(applications)
		.where(eq(applications.id, appId))
		.limit(1);

	return app || null;
}

/**
 * Create a new application
 */
export async function createApplication(data: NewApplication) {
	const [app] = await db.insert(applications).values(data).returning();
	return app;
}

/**
 * Update an application
 */
export async function updateApplication(
	appId: string,
	data: Partial<NewApplication>
) {
	const [app] = await db
		.update(applications)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(eq(applications.id, appId))
		.returning();

	return app || null;
}

/**
 * Delete an application
 */
export async function deleteApplication(appId: string) {
	const [deletedApp] = await db
		.delete(applications)
		.where(eq(applications.id, appId))
		.returning();

	return deletedApp;
}
