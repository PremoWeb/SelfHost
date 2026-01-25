import { db } from '$lib/server/db';
import { sources } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { requireAuth, requireTeam } from '$lib/server/auth/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	await requireAuth(locals);
	await requireTeam(locals);

	const [source] = await db
		.select()
		.from(sources)
		.where(eq(sources.id, params.id))
		.limit(1);

	if (!source) {
		throw error(404, 'Source not found');
	}

	if (source.teamId !== locals.team.id) {
		throw error(403, 'Forbidden');
	}

	return {
		source
	};
};
