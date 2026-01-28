import { db } from '../db/client';
import { instanceSettings } from '../db/schema';
import { eq } from 'drizzle-orm';

// In-memory cache for settings to avoid DB hits on every request
let settingsCache: any = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Get instance settings
 */
export async function getInstanceSettings(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && settingsCache && (now - lastCacheUpdate < CACHE_TTL)) {
        return settingsCache;
    }

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
        
        settingsCache = newSettings;
        lastCacheUpdate = now;
        return newSettings;
    }

    settingsCache = settings;
    lastCacheUpdate = now;
	return settings;
}

/**
 * Update instance settings
 */
export async function updateInstanceSettings(data: {
	fqdn?: string;
	registrationEnabled?: boolean;
	doNotTrack?: boolean;
	websiteMode?: boolean;
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
