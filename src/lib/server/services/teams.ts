import { db } from '../db/client';
import { teams, users, teamMembers } from '../db/schema';
import { eq, and, ne } from 'drizzle-orm';


/**
 * Get all teams (optionally excluding one)
 */
export async function getAllTeams(excludeTeamId?: string) {
    if (excludeTeamId) {
        return db.select().from(teams).where(ne(teams.id, excludeTeamId)).orderBy(teams.name);
    }
    return db.select().from(teams).orderBy(teams.name);
}

/**
 * Get all members of a team
 */
export async function getTeamMembers(teamId: string) {
	return db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			role: teamMembers.role,
			joinedAt: teamMembers.createdAt
		})
		.from(teamMembers)
		.innerJoin(users, eq(teamMembers.userId, users.id))
		.where(eq(teamMembers.teamId, teamId))
		.orderBy(teamMembers.createdAt);
}

/**
 * Get team by ID
 */
export async function getTeamById(teamId: string) {
	const [team] = await db
		.select()
		.from(teams)
		.where(eq(teams.id, teamId))
		.limit(1);

	return team || null;
}

/**
 * Update team information
 */
export async function updateTeam(teamId: string, data: { name?: string; description?: string }) {
	const [team] = await db
		.update(teams)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(eq(teams.id, teamId))
		.returning();

	return team || null;
}

/**
 * Get all teams for a user
 */
export async function getTeamsForUser(userId: string) {
	return db
		.select({
			id: teams.id,
			name: teams.name,
			description: teams.description,
			personalTeam: teams.personalTeam,
			role: teamMembers.role
		})
		.from(teamMembers)
		.innerJoin(teams, eq(teamMembers.teamId, teams.id))
		.where(eq(teamMembers.userId, userId))
		.orderBy(teams.name);
}
