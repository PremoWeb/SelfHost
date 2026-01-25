import { db } from '../../db/client';
import { domains, teams } from '../../db/schema';
import { eq, and, or } from 'drizzle-orm';
import type { NewDomain } from '../../db/schema';

export async function getDomainsByTeam(teamId: string | null | undefined) {
	if (!teamId) return [];
	
	return db
		.select()
		.from(domains)
		.where(
			or(
				eq(domains.teamId, teamId),
				and(eq(domains.ownerType, 'team'), eq(domains.ownerId, teamId))
			)
		)
		.orderBy(domains.name);
}

export async function createDomain(data: NewDomain & { companyId?: string | null }) {
	const { companyId, ...domainData } = data;
	
	// If companyId is provided, set ownerType and ownerId
	if (companyId) {
		domainData.ownerType = 'company';
		domainData.ownerId = companyId;
	}
	// If no companyId and no ownerType/ownerId, it will default to teamId (backward compatibility)
	
	// If no nameserverProfileId is provided, check for team default
	if (!domainData.nameserverProfileId && domainData.teamId) {
		const [team] = await db
			.select({ defaultNameserverProfileId: teams.defaultNameserverProfileId })
			.from(teams)
			.where(eq(teams.id, domainData.teamId))
			.limit(1);
			
		if (team?.defaultNameserverProfileId) {
			domainData.nameserverProfileId = team.defaultNameserverProfileId;
		}
	}

	const [domain] = await db.insert(domains).values(domainData).returning();
	return domain;
}

export async function deleteDomain(id: string, teamId: string | null | undefined) {
	const whereConditions = [eq(domains.id, id)];
	if (teamId) {
		whereConditions.push(
			or(
				eq(domains.teamId, teamId),
				and(eq(domains.ownerType, 'team'), eq(domains.ownerId, teamId))
			)
		);
	}

	const [deleted] = await db
		.delete(domains)
		.where(and(...whereConditions))
		.returning();
	return deleted;
}
