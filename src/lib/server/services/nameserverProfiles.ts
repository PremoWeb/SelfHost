import { db } from '../db/client';
import { nameserverProfiles, teams, nameserverProfileShares } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { NewNameserverProfile } from '../db/schema';

export async function getNameserverProfilesByTeam(teamId: string | null | undefined) {
    if (!teamId) {
        return db.query.nameserverProfiles.findMany({
            with: {
                dnsProvider: true
            },
            orderBy: (nameserverProfiles, { asc }) => [asc(nameserverProfiles.name)]
        });
    }

	return db.query.nameserverProfiles.findMany({
		where: eq(nameserverProfiles.teamId, teamId),
		with: {
			dnsProvider: true
		},
		orderBy: (nameserverProfiles, { asc }) => [asc(nameserverProfiles.name)]
	});
}

export async function createNameserverProfile(data: NewNameserverProfile) {
	const [profile] = await db.insert(nameserverProfiles).values(data).returning();
	return profile;
}

export async function deleteNameserverProfile(id: string, teamId: string) {
	const [deleted] = await db
		.delete(nameserverProfiles)
		.where(and(eq(nameserverProfiles.id, id), eq(nameserverProfiles.teamId, teamId)))
		.returning();
	return deleted;
}

export async function setDefaultNameserverProfile(teamId: string, profileId: string | null) {
	const [updatedTeam] = await db
		.update(teams)
		.set({
			defaultNameserverProfileId: profileId,
			updatedAt: new Date()
		})
		.where(eq(teams.id, teamId))
		.returning();
	return updatedTeam;
}

export async function shareNameserverProfile(profileId: string, assigneeType: 'user' | 'team' | 'company', assigneeId: string, role: 'use' | 'manage' = 'use') {
    // Check if share already exists to avoid duplicates (could also use upsert if supported/needed)
    const existing = await db.query.nameserverProfileShares.findFirst({
        where: and(
            eq(nameserverProfileShares.profileId, profileId),
            eq(nameserverProfileShares.assigneeId, assigneeId),
            eq(nameserverProfileShares.assigneeType, assigneeType)
        )
    });

    if (existing) {
        // Update role if already shared
        const [updated] = await db
            .update(nameserverProfileShares)
            .set({ role })
            .where(eq(nameserverProfileShares.id, existing.id))
            .returning();
        return updated;
    }

	const [share] = await db.insert(nameserverProfileShares).values({
        profileId,
        assigneeType,
        assigneeId,
        role
    }).returning();
	return share;
}

export async function getNameserverProfileShares(profileId: string) {
    return db.query.nameserverProfileShares.findMany({
        where: eq(nameserverProfileShares.profileId, profileId)
    });
}

export async function removeNameserverProfileShare(shareId: string) {
    return db.delete(nameserverProfileShares).where(eq(nameserverProfileShares.id, shareId));
}
