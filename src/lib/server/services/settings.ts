import { db } from '../db/client';
import { instanceSettings } from '../db/schema';

/**
 * Get instance settings
 */
export async function getInstanceSettings() {
	const [settings] = await db.select().from(instanceSettings).limit(1);
    
    if (!settings) {
        // Create default settings if not exists
        const [newSettings] = await db
            .insert(instanceSettings)
            .values({
                instanceId: crypto.randomUUID(),
                registrationEnabled: true
            })
            .returning();
        return newSettings;
    }

	return settings;
}

/**
 * Update instance settings
 */
export async function updateInstanceSettings(data: {
	fqdn?: string;
	registrationEnabled?: boolean;
	doNotTrack?: boolean;
}) {
	const current = await getInstanceSettings();
	if (!current) {
		// Create if not exists
		const [newSettings] = await db
			.insert(instanceSettings)
			.values({
				...data
			})
			.returning();
		return newSettings;
	}

	const [updatedSettings] = await db
		.update(instanceSettings)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(eq(instanceSettings.id, current.id))
		.returning();

	return updatedSettings;
}

import { eq } from 'drizzle-orm';
