import 'dotenv/config';
import { db } from '../src/lib/server/db/client';
import { users, teams, teamMembers } from '../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';

async function createTeamForUser() {
	try {
		// Get the first user
		const firstUser = await db.query.users.findFirst({
			orderBy: (users, { asc }) => [asc(users.createdAt)]
		});

		if (!firstUser) {
			console.error('No users found in database');
			process.exit(1);
		}

		console.log(`Found user: ${firstUser.email} (${firstUser.id})`);

		// Check if user already has a team
		const existingTeams = await db.query.teamMembers.findMany({
			where: (teamMembers, { eq }) => eq(teamMembers.userId, firstUser.id)
		});

		if (existingTeams.length > 0) {
			console.log('User already has teams:', existingTeams.map(t => t.teamId));
			process.exit(0);
		}

		// Create personal team
		console.log('Creating personal team...');
		const [team] = await db
			.insert(teams)
			.values({
				name: `${firstUser.name || firstUser.email}'s Team`,
				personalTeam: true
			})
			.returning();

		console.log(`Created team: ${team.name} (${team.id})`);

		// Add user to team as owner
		await db.insert(teamMembers).values({
			teamId: team.id,
			userId: firstUser.id,
			role: 'owner'
		});

		console.log(`Successfully created team and added ${firstUser.email} as owner`);
		process.exit(0);
	} catch (error) {
		console.error('Failed to create team:', error);
		process.exit(1);
	}
}

createTeamForUser();
