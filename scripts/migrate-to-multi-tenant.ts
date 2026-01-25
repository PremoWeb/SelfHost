/**
 * Migration script to convert existing teams to companies and migrate data
 * Run this after applying the database migration
 */
import 'dotenv/config';
import { db } from '../src/lib/server/db/client';
import { teams, teamMembers, companies, companyMembers, projects, projectAssignments, users } from '../src/lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getEnforcer } from '../src/lib/server/auth/casbin';
import { count } from 'drizzle-orm';

async function migrateToMultiTenant() {
	console.log('[Migration] Starting multi-tenant migration...');

	try {
		// Step 1: Get all teams
		const allTeams = await db.query.teams.findMany({
			with: {
				members: {
					with: {
						user: true
					}
				}
			}
		});

		console.log(`[Migration] Found ${allTeams.length} teams to migrate`);

		// Step 2: Convert each team to a company
		for (const team of allTeams) {
			// Find the team owner (first member with owner role, or first member)
			const owner = team.members.find((m) => m.role === 'owner') || team.members[0];

			if (!owner) {
				console.log(`[Migration] Skipping team ${team.id} - no owner found`);
				continue;
			}

			// Create company from team
			const slug = team.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
			
			// Check if company with this slug already exists
			const existingCompany = await db.query.companies.findFirst({
				where: (companies, { eq }) => eq(companies.slug, slug)
			});

			if (existingCompany) {
				console.log(`[Migration] Company with slug "${slug}" already exists, skipping team ${team.id}`);
				continue;
			}

			const [company] = await db
				.insert(companies)
				.values({
					name: team.name,
					description: team.description || null,
					slug,
					createdBy: owner.userId,
					settings: {}
				})
				.returning();

			console.log(`[Migration] Created company "${company.name}" (${company.id}) from team ${team.id}`);

			// Link team to company
			await db.update(teams).set({ companyId: company.id }).where(eq(teams.id, team.id));

			// Migrate team members to company members
			for (const member of team.members) {
				// Check if already a company member
				const existing = await db
					.select()
					.from(companyMembers)
					.where(and(eq(companyMembers.companyId, company.id), eq(companyMembers.userId, member.userId)))
					.limit(1);

				if (existing.length === 0) {
					await db.insert(companyMembers).values({
						companyId: company.id,
						userId: member.userId,
						role: member.role === 'owner' ? 'owner' : member.role === 'admin' ? 'admin' : 'member'
					});
				}
			}

			// Assign company_owner role to owner via Casbin
			if (owner.role === 'owner') {
				const enforcer = await getEnforcer();
				await enforcer.addGroupingPolicy(owner.userId, 'company_owner');
			}

			// Update projects to link to company
			await db.update(projects).set({ companyId: company.id }).where(eq(projects.teamId, team.id));

			// Create project assignments for team-based projects
			const teamProjects = await db.select().from(projects).where(eq(projects.teamId, team.id));
			for (const project of teamProjects) {
				// Check if assignment already exists
				const existing = await db
					.select()
					.from(projectAssignments)
					.where(
						and(
							eq(projectAssignments.projectId, project.id),
							eq(projectAssignments.assigneeType, 'team'),
							eq(projectAssignments.assigneeId, team.id)
						)
					)
					.limit(1);

				if (existing.length === 0) {
					await db.insert(projectAssignments).values({
						projectId: project.id,
						assigneeType: 'team',
						assigneeId: team.id,
						role: 'owner'
					});
				}
			}
		}

		// Step 3: Set god role for first user
		const [userCount] = await db.select({ count: count() }).from(users);
		if (userCount.count > 0) {
			const firstUser = await db.query.users.findFirst({
				orderBy: (users, { asc }) => [asc(users.createdAt)]
			});

			if (firstUser && !firstUser.isGod) {
				await db.update(users).set({ isGod: true }).where(eq(users.id, firstUser.id));

				const enforcer = await getEnforcer();
				await enforcer.addGroupingPolicy(firstUser.id, 'god');
				await enforcer.addGroupingPolicy(firstUser.id, 'super_admin');
				await enforcer.savePolicy();

				console.log(`[Migration] Set god role for first user: ${firstUser.email}`);
			}
		}

		console.log('[Migration] Migration completed successfully!');
		process.exit(0);
	} catch (error) {
		console.error('[Migration] Migration failed:', error);
		process.exit(1);
	}
}

migrateToMultiTenant();
