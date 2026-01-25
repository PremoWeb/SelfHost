import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sources } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { generateGitHubAppToken } from '$lib/server/services/github-app';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
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

        if (!source.isApp || !source.appId || !source.privateKey) {
            return json({ error: 'Not a GitHub App source' }, { status: 400 });
        }

        // Generate JWT token
        const jwt = generateGitHubAppToken(source.appId, source.privateKey);

        // Get installations for this app
        const response = await fetch('https://api.github.com/app/installations', {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${jwt}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch installations');
        }

        const installations = await response.json();

        // If we have exactly one installation and no installation_id stored, update it
        if (installations.length === 1 && !source.installationId) {
            await db
                .update(sources)
                .set({ installationId: installations[0].id.toString() })
                .where(eq(sources.id, source.id));
        }

        return json({ installations });
    } catch (error: any) {
        return json({ error: error.message || 'Failed to fetch installations' }, { status: 500 });
    }
};
