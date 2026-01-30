import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { db } from '../db/client';
import * as schema from '../db/schema';
import { getEnforcer } from './casbin';
import { eq, asc } from 'drizzle-orm';
import { isGod } from './permissions';

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		schema: {
			user: schema.users,
			session: schema.sessions,
			account: schema.accounts,
			verification: schema.verifications
		}
	}),
	emailAndPassword: {
		enabled: true
	},
	plugins: [
		admin({
			impersonationSessionDuration: 60 * 60 * 24, // 24 hours
			// Only allow God users to impersonate
			async isAdmin(userId: string) {
				return await isGod(userId);
			}
		}),
		{
			id: 'first-user-super-admin',
			hooks: {
				after: [
					{
						matcher: (context: any) => context.path === '/sign-up/email',
						handler: async (ctx: any) => {
							const { response } = ctx;
							if (response && response.ok) {
								const clone = response.clone();
								try {
									const body = await clone.json();
									const user = body.user;
									if (user) {
										// Create a personal team for the new user
										// Check if user already has a team (shouldn't happen on sign-up, but be safe)
										const existingTeams = await db.query.teamMembers.findMany({
											where: (teamMembers, { eq }) => eq(teamMembers.userId, user.id)
										});

										if (existingTeams.length === 0) {
											// Create personal team
											const [team] = await db
												.insert(schema.teams)
												.values({
													name: `${user.name || user.email}'s Team`,
													personalTeam: true
												})
												.returning();

											// Add user to team as owner
											await db.insert(schema.teamMembers).values({
												teamId: team.id,
												userId: user.id,
												role: 'owner'
											});
										}

										// Assign God to the actual first user (by createdAt), not by count-at-hook-time.
										// This avoids giving God to the second signup when the first user isn't committed yet.
										const hasAnyGod = await db
											.select({ id: schema.users.id })
											.from(schema.users)
											.where(eq(schema.users.isGod, true))
											.limit(1);
										if (hasAnyGod.length === 0) {
											// No God yet: make the earliest-created user God (true first user)
											const firstUser = await db
												.select({ id: schema.users.id })
												.from(schema.users)
												.orderBy(asc(schema.users.createdAt))
												.limit(1);
											if (firstUser.length > 0) {
												const godUserId = firstUser[0].id;
												await db
													.update(schema.users)
													.set({ isGod: true })
													.where(eq(schema.users.id, godUserId));
												const e = await getEnforcer();
												await e.addGroupingPolicy(godUserId, 'god');
												await e.addGroupingPolicy(godUserId, 'super_admin');
												await e.savePolicy();
											}
										}
									}
								} catch (e) {
									// Silently fail - sign-up hook errors shouldn't break registration
								}
							}
							return { response: ctx.response };
						}
					}
				]
			}
		}
	]
});
