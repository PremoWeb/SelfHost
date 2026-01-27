import { db } from '../db/client';
import { users, sessions, teams, teamMembers, type User, type Team } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

export type AuthResponse =
	| { success: true; user: User; session: { sessionId: string; expiresAt: Date }; team?: Team }
	| { success: false; error: string };

const SALT_ROUNDS = 10;
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

/**
 * Generate a session ID
 */
function generateSessionId(): string {
	return randomBytes(32).toString('hex');
}

/**
 * Create a new session for a user
 */
export async function createSession(userId: string, teamId?: string) {
	const sessionId = generateSessionId();
	const expiresAt = new Date(Date.now() + SESSION_DURATION);

	await db.insert(sessions).values({
		id: sessionId,
		userId,
		teamId,
		expiresAt
	});

	return { sessionId, expiresAt };
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string) {
	const [session] = await db
		.select()
		.from(sessions)
		.where(eq(sessions.id, sessionId))
		.limit(1);

	if (!session) return null;

	// Check if session is expired
	if (session.expiresAt < new Date()) {
		await deleteSession(sessionId);
		return null;
	}

	return session;
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string) {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Delete all sessions for a user
 */
export async function deleteUserSessions(userId: string) {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Login user
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
	const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

	if (!user) {
		return { success: false, error: 'Invalid credentials' };
	}

	const valid = await verifyPassword(password, user.password);

	if (!valid) {
		return { success: false, error: 'Invalid credentials' };
	}

	const currentTeam = await getUserCurrentTeam(user.id);
	const session = await createSession(user.id, currentTeam?.id);

	return {
		success: true,
		user,
		session,
		team: currentTeam || undefined
	};
}

/**
 * Register new user
 */
export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
	// Check if user already exists
	const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

	if (existingUser) {
		return { success: false, error: 'Email already in use' };
	}

	// Hash password
	const hashedPassword = await hashPassword(password);

	// Create user
	const [user] = await db
		.insert(users)
		.values({
			name,
			email,
			password: hashedPassword
		})
		.returning();

	// Create personal team
	const [team] = await db
		.insert(teams)
		.values({
			name: `${name}'s Team`,
			personalTeam: true
		})
		.returning();

	// Add user to team as owner
	await db.insert(teamMembers).values({
		teamId: team.id,
		userId: user.id,
		role: 'owner'
	});

	// Create session
	const session = await createSession(user.id, team.id);

	return {
		success: true,
		user,
		team,
		session
	};
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
	const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	return user || null;
}

/**
 * Get user's teams
 */
export async function getUserTeams(userId: string) {
	const userTeams = await db
		.select({
			team: teams,
			role: teamMembers.role
		})
		.from(teamMembers)
		.innerJoin(teams, eq(teamMembers.teamId, teams.id))
		.where(eq(teamMembers.userId, userId));

	return userTeams;
}

/**
 * Get user's current team (from session, first team or personal team)
 */
export async function getUserCurrentTeam(userId: string, sessionTeamId?: string | null) {
	const userTeams = await getUserTeams(userId);

	if (userTeams.length === 0) return null;

	// If session has a teamId, try to find it in user's teams
	if (sessionTeamId) {
		const sessionTeam = userTeams.find((t) => t.team.id === sessionTeamId);
		if (sessionTeam) return sessionTeam.team;
	}

	// Prefer personal team
	const personalTeam = userTeams.find((t) => t.team.personalTeam);
	if (personalTeam) return personalTeam.team;

	// Otherwise return first team
	return userTeams[0].team;
}

/**
 * Update the active team in the session
 */
export async function setSessionTeam(sessionId: string, teamId: string | null) {
	await db.update(sessions).set({ activeTeamId: teamId }).where(eq(sessions.id, sessionId));
}

/**
 * Update the active company in the session
 */
export async function setSessionCompany(sessionId: string, companyId: string | null) {
	await db.update(sessions).set({ activeCompanyId: companyId }).where(eq(sessions.id, sessionId));
}
