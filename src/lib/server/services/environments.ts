import { db } from '../db/client';
import { environments } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Get environment by ID
 */
export async function getEnvironmentById(envId: string) {
	const [env] = await db
		.select()
		.from(environments)
		.where(eq(environments.id, envId))
		.limit(1);

	return env || null;
}
