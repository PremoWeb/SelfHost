import { getSourcesByTeam } from '$lib/server/services/sources';
import { requireAuth } from '$lib/server/auth/permissions';
import { db } from '$lib/server/db/client';
import { gitRepositories } from '$lib/server/db/git-schema';
import { projects, type Source } from '$lib/server/db/schema';
import { getRepositoryNamespace } from '$lib/server/services/git';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

type GitRepository = typeof gitRepositories.$inferSelect;
type Project = typeof projects.$inferSelect;

export const load: PageServerLoad = async ({ locals }) => {
	await requireAuth(locals);

	let sources: Source[] = [];
	let builtInRepos: (GitRepository & { project: Project; namespace: string | null })[] = [];

	if (locals.team) {
		sources = await getSourcesByTeam(locals.team.id);
		
		// Get all built-in repositories for projects in this team
		// This is a simplified query - in production you might want to filter by team access
		const repos = await db
			.select({
				repository: gitRepositories,
				project: projects
			})
			.from(gitRepositories)
			.innerJoin(projects, eq(gitRepositories.projectId, projects.id))
			.where(eq(projects.teamId, locals.team.id));
		
		// Get namespace for each repository
		// Use Promise.allSettled to handle any individual failures gracefully
		const reposWithNamespace = await Promise.allSettled(
			repos.map(async (r) => {
				const namespace = await getRepositoryNamespace(r.repository.id);
				return {
					...r.repository,
					project: r.project,
					namespace: namespace || null
				};
			})
		);
		
		// Extract successful results, skip failed ones
		builtInRepos = reposWithNamespace
			.filter((result): result is PromiseFulfilledResult<GitRepository & { project: Project; namespace: string | null }> => result.status === 'fulfilled')
			.map(result => result.value);
	}

	return {
		sources,
		builtInRepos
	};
};
