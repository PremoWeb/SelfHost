import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sources } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getInstallationAccessToken, listInstallationRepositories } from '$lib/server/services/github-app';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
    await requireApiAuth(locals);
    await requireTeam(locals);

    const { id } = params;

    try {
        // Get the source
        const [source] = await db
            .select()
            .from(sources)
            .where(eq(sources.id, id))
            .limit(1);

        if (!source) {
            return json({ error: 'Source not found' }, { status: 404 });
        }

        if (source.teamId !== locals.team.id) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        // Handle GitHub App
        if (source.isApp && source.appId && source.privateKey && source.installationId) {
            const accessToken = await getInstallationAccessToken(
                source.appId,
                source.privateKey,
                source.installationId
            );

            const repositories = await listInstallationRepositories(accessToken);

            return json({
                repositories: repositories.map((repo: any) => ({
                    id: repo.id,
                    name: repo.name,
                    full_name: repo.full_name,
                    private: repo.private,
                    description: repo.description,
                    default_branch: repo.default_branch,
                    html_url: repo.html_url
                }))
            });
        }

        // Handle PAT (Personal Access Token)
        if (source.token) {
            const response = await fetch('https://api.github.com/user/repos?per_page=100', {
                headers: {
                    'Authorization': `token ${source.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch repositories');
            }

            const repositories = await response.json();

            return json({
                repositories: repositories.map((repo: any) => ({
                    id: repo.id,
                    name: repo.name,
                    full_name: repo.full_name,
                    private: repo.private,
                    description: repo.description,
                    default_branch: repo.default_branch,
                    html_url: repo.html_url
                }))
            });
        }

        return json({ error: 'Source not configured properly' }, { status: 400 });
    } catch (error: any) {
        return json({ error: error.message || 'Failed to fetch repositories' }, { status: 500 });
    }
};
