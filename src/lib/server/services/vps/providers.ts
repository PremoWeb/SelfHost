import { db } from '../../db/client';
import { vpsProviders, servers, destinations, applications, databases, quickDeployApps, nameserverProfiles, domains } from '../../db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import type { NewVpsProvider } from '../../db/schema';

export async function getVpsProvidersByTeam(teamId: string | null | undefined) {
	// If no teamId, assume God mode/admin view and show all (or filter differently if needed)
    // For now, if no teamId is provided, we'll return all providers to allow God users to see them
    // Logic should be refined if we want to restict God view to specific contexts, but this matches the user request.
    
	try {
        const query = sql`
            SELECT 
                p.*,
                COUNT(DISTINCT s.id) as server_count,
                COALESCE(SUM(DISTINCT COALESCE(app_counts.count, 0)), 0) + COALESCE(SUM(DISTINCT COALESCE(qd_counts.count, 0)), 0) as application_count,
                COALESCE(SUM(DISTINCT COALESCE(db_counts.count, 0)), 0) as database_count,
                COALESCE(domain_counts.count, 0) as domain_count
            FROM ${vpsProviders} p
            LEFT JOIN ${servers} s ON s.vps_provider_id = p.id
            LEFT JOIN (
                SELECT d.server_id, COUNT(a.id) as count
                FROM ${destinations} d
                JOIN ${applications} a ON a.destination_id = d.id
                GROUP BY d.server_id
            ) app_counts ON app_counts.server_id = s.id
            LEFT JOIN (
                SELECT d.server_id, COUNT(db.id) as count
                FROM ${destinations} d
                JOIN ${databases} db ON db.destination_id = d.id
                GROUP BY d.server_id
            ) db_counts ON db_counts.server_id = s.id
            LEFT JOIN (
                SELECT server_id, COUNT(*) as count
                FROM ${quickDeployApps}
                GROUP BY server_id
            ) qd_counts ON qd_counts.server_id = s.id
            LEFT JOIN (
                SELECT 
                    p.id as provider_id,
                    COUNT(DISTINCT d.id) as count
                FROM ${vpsProviders} p
                LEFT JOIN ${domains} d ON (
                    (d.nameserver_profile_id IN (
                        SELECT id FROM ${nameserverProfiles} WHERE dns_provider_id = p.id
                    ))
                    OR 
                    (d.provider = p.type AND (
                        (d.team_id IS NOT NULL AND d.team_id = p.team_id) OR
                        (d.owner_type = p.owner_type AND d.owner_id = p.owner_id)
                    ))
                )
                GROUP BY p.id
            ) domain_counts ON domain_counts.provider_id = p.id
            WHERE ${teamId ? sql`(p.team_id = ${teamId} OR (p.owner_type = 'team' AND p.owner_id = ${teamId}))` : sql`1=1`}
            GROUP BY p.id
            ORDER BY p.name ASC
        `;

        const result = await db.all(query);
        return result.map((row: any) => ({
            ...row,
            apiKey: row.api_key,
            dnsEnabled: Boolean(row.dns_enabled),
            teamId: row.team_id,
            server_count: Number(row.server_count),
            application_count: Number(row.application_count),
            database_count: Number(row.database_count),
            domain_count: Number(row.domain_count),
            createdAt: new Date(row.created_at as string),
            updatedAt: new Date(row.updated_at as string)
        })) as any[];
	} catch (err: any) {
		throw err;
	}
}

export async function getVpsProviderById(id: string, teamId: string | null | undefined) {
	try {
        const query = sql`
            SELECT 
                p.*,
                COUNT(DISTINCT s.id) as server_count,
                COALESCE(SUM(DISTINCT COALESCE(app_counts.count, 0)), 0) + COALESCE(SUM(DISTINCT COALESCE(qd_counts.count, 0)), 0) as application_count,
                COALESCE(SUM(DISTINCT COALESCE(db_counts.count, 0)), 0) as database_count,
                COALESCE(domain_counts.count, 0) as domain_count
            FROM ${vpsProviders} p
            LEFT JOIN ${servers} s ON s.vps_provider_id = p.id
            LEFT JOIN (
                SELECT d.server_id, COUNT(a.id) as count
                FROM ${destinations} d
                JOIN ${applications} a ON a.destination_id = d.id
                GROUP BY d.server_id
            ) app_counts ON app_counts.server_id = s.id
            LEFT JOIN (
                SELECT d.server_id, COUNT(db.id) as count
                FROM ${destinations} d
                JOIN ${databases} db ON db.destination_id = d.id
                GROUP BY d.server_id
            ) db_counts ON db_counts.server_id = s.id
            LEFT JOIN (
                SELECT server_id, COUNT(*) as count
                FROM ${quickDeployApps}
                GROUP BY server_id
            ) qd_counts ON qd_counts.server_id = s.id
            LEFT JOIN (
                SELECT 
                    p.id as provider_id,
                    COUNT(DISTINCT d.id) as count
                FROM ${vpsProviders} p
                LEFT JOIN ${domains} d ON (
                    (d.nameserver_profile_id IN (
                        SELECT id FROM ${nameserverProfiles} WHERE dns_provider_id = p.id
                    ))
                    OR 
                    (d.provider = p.type AND (
                        (d.team_id IS NOT NULL AND d.team_id = p.team_id) OR
                        (d.owner_type = p.owner_type AND d.owner_id = p.owner_id)
                    ))
                )
                WHERE p.id = ${id}
                GROUP BY p.id
            ) domain_counts ON domain_counts.provider_id = p.id
            WHERE p.id = ${id} ${teamId ? sql`AND (p.team_id = ${teamId} OR (p.owner_type = 'team' AND p.owner_id = ${teamId}))` : sql``}
            GROUP BY p.id
            LIMIT 1
        `;

        const result = await db.all(query);
        if (result.length === 0) return null;

        const row: any = result[0];
        return {
            ...row,
            apiKey: row.api_key,
            dnsEnabled: Boolean(row.dns_enabled),
            teamId: row.team_id,
            server_count: Number(row.server_count),
            application_count: Number(row.application_count),
            database_count: Number(row.database_count),
            domain_count: Number(row.domain_count),
            createdAt: new Date(row.created_at as string),
            updatedAt: new Date(row.updated_at as string)
        };
	} catch (err: any) {
		throw err;
	}
}

export async function createVpsProvider(data: NewVpsProvider & { companyId?: string | null }) {
	const { companyId, ...providerData } = data;
	
	// If companyId is provided, set ownerType and ownerId
	if (companyId) {
		providerData.ownerType = 'company';
		providerData.ownerId = companyId;
	}
	// If no companyId and no ownerType/ownerId, it will default to teamId (backward compatibility)
	
	const [provider] = await db.insert(vpsProviders).values(providerData).returning();
	return provider;
}

export async function updateVpsProvider(id: string, teamId: string | null | undefined, data: Partial<NewVpsProvider>) {
	const whereConditions: any[] = [eq(vpsProviders.id, id)];
	if (teamId !== null && teamId !== undefined) {
		const teamCond = or(
			eq(vpsProviders.teamId, teamId),
			and(eq(vpsProviders.ownerType, 'team'), eq(vpsProviders.ownerId, teamId))
		);
		if (teamCond) whereConditions.push(teamCond);
	}

	const [provider] = await db
		.update(vpsProviders)
		.set({ ...data, updatedAt: new Date() })
		.where(and(...whereConditions))
		.returning();
	return provider || null;
}

export async function deleteVpsProvider(id: string, teamId: string | null | undefined) {
	const whereConditions: any[] = [eq(vpsProviders.id, id)];
	if (teamId !== null && teamId !== undefined) {
		const teamCond = or(
			eq(vpsProviders.teamId, teamId),
			and(eq(vpsProviders.ownerType, 'team'), eq(vpsProviders.ownerId, teamId))
		);
		if (teamCond) whereConditions.push(teamCond);
	}

	const [deleted] = await db
		.delete(vpsProviders)
		.where(and(...whereConditions))
		.returning();
	return deleted;
}
