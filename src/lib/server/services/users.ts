import { db } from '../db/client';
import { users, teams, teamMembers, accounts, companyMembers } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { hashPassword } from '../auth/session';
import { getEnforcer } from '../auth/casbin';
import { addCompanyMember } from './companies';

/**
 * Update user profile
 */
export async function updateUserProfile(userId: string, data: { name?: string; email?: string }) {
	const [user] = await db
		.update(users)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(eq(users.id, userId))
		.returning();

	return user || null;
}

/**
 * Create a new user (admin function)
 * This creates a user with Better Auth's account structure
 */
export async function createUser(data: {
	name: string;
	email: string;
	password: string;
	companyIds?: string[];
	teamIds?: string[];
}) {
	// Check if user already exists
	const [existingUser] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

	if (existingUser) {
		throw new Error('Email already in use');
	}

	// Hash password
	const hashedPassword = await hashPassword(data.password);

	// Create user
	const [user] = await db
		.insert(users)
		.values({
			name: data.name,
			email: data.email,
			emailVerified: false // Admin-created users need to verify email
		})
		.returning();

	// Create Better Auth account with password
	await db.insert(accounts).values({
		accountId: user.id,
		providerId: 'credential',
		userId: user.id,
		password: hashedPassword
	});

	// Create personal team for the new user
	const [team] = await db
		.insert(teams)
		.values({
			name: `${data.name}'s Team`,
			personalTeam: true
		})
		.returning();

	// Add user to personal team as owner
	await db.insert(teamMembers).values({
		teamId: team.id,
		userId: user.id,
		role: 'owner'
	});

	// Add user to specified companies
	if (data.companyIds && data.companyIds.length > 0) {
		for (const companyId of data.companyIds) {
			await addCompanyMember(companyId, user.id, 'member');
		}
	}

	// Add user to specified teams (in addition to personal team)
	if (data.teamIds && data.teamIds.length > 0) {
		for (const teamId of data.teamIds) {
			// Check if user is already a member
			const existing = await db
				.select()
				.from(teamMembers)
				.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)))
				.limit(1);

			if (existing.length === 0) {
				await db.insert(teamMembers).values({
					teamId,
					userId: user.id,
					role: 'member'
				});
			}
		}
	}

	return { user, team };
}
