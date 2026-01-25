import { db } from '../db/client';
import { s3Storages } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { NewS3Storage } from '../db/schema';

/**
 * Get all S3 storages for a team
 */
export async function getS3StoragesByTeam(teamId: string) {
	return db
		.select()
		.from(s3Storages)
		.where(eq(s3Storages.teamId, teamId))
		.orderBy(s3Storages.createdAt);
}

/**
 * Get S3 storage by ID
 */
export async function getS3StorageById(s3Id: string, teamId: string) {
	const [s3] = await db
		.select()
		.from(s3Storages)
		.where(eq(s3Storages.id, s3Id))
		.limit(1);

	if (s3 && s3.teamId !== teamId) {
		return null;
	}

	return s3 || null;
}

/**
 * Create a new S3 storage
 */
export async function createS3Storage(data: NewS3Storage) {
	const [s3] = await db.insert(s3Storages).values(data).returning();
	return s3;
}

/**
 * Update an S3 storage
 */
export async function updateS3Storage(
	s3Id: string,
	teamId: string,
	data: Partial<NewS3Storage>
) {
	const [s3] = await db
		.update(s3Storages)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(eq(s3Storages.id, s3Id))
		.returning();

	if (s3 && s3.teamId !== teamId) {
		return null;
	}

	return s3 || null;
}

/**
 * Delete an S3 storage
 */
export async function deleteS3Storage(s3Id: string, teamId: string) {
	const s3 = await getS3StorageById(s3Id, teamId);
	if (!s3) return null;

	const [deletedS3] = await db
		.delete(s3Storages)
		.where(eq(s3Storages.id, s3Id))
		.returning();

	return deletedS3;
}
