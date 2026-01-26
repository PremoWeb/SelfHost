import { db } from '../db/client';
import { deployments, applications, destinations, servers } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Get all deployments for a team
 * Deployments are linked to applications, which are linked to destinations, which are linked to servers
 */
export async function getDeploymentsByTeam(teamId: string | null | undefined, isGodUser?: boolean) {
	try {
		// If teamId is null and user is god, return all deployments
		// Otherwise, filter by team through the server relationship
		const query = sql`
			SELECT DISTINCT d.*
			FROM ${deployments} d
			INNER JOIN ${applications} a ON d.application_id = a.id
			INNER JOIN ${destinations} dest ON a.destination_id = dest.id
			INNER JOIN ${servers} s ON dest.server_id = s.id
			WHERE ${teamId ? sql`s.team_id = ${teamId}` : (isGodUser ? sql`1=1` : sql`1=0`)}
			ORDER BY d.created_at DESC
		`;

		const result = await db.all(query);
		return result.map((row: any) => ({
			id: row.id,
			status: row.status,
			commit: row.commit,
			commitMessage: row.commit_message,
			applicationId: row.application_id,
			startedAt: row.started_at ? new Date(row.started_at * 1000) : null,
			finishedAt: row.finished_at ? new Date(row.finished_at * 1000) : null,
			createdAt: row.created_at ? new Date(row.created_at * 1000) : new Date(),
			updatedAt: row.updated_at ? new Date(row.updated_at * 1000) : new Date()
		}));
	} catch (err: any) {
		console.error('Error fetching deployments by team:', err);
		return [];
	}
}
