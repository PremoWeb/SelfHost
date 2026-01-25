import { json } from '@sveltejs/kit';
import { getS3StoragesByTeam, createS3Storage } from '$lib/server/services/storages';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	await requireApiAuth(locals);

	if (!locals.team) {
		return json({ data: [] });
	}

	const storages = await getS3StoragesByTeam(locals.team.id);
	return json({ data: storages });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireApiAuth(locals);
	
	// God users can create storages, but still need a teamId for the storage
	// For now, require team even for god users (they can create a team first)
	if (!locals.team) {
		return json({ message: 'Team required for this operation' }, { status: 400 });
	}

	const { name, description, endpoint, region, bucket, accessKey, secretKey } = await request.json();

	if (!name || !endpoint || !bucket || !accessKey || !secretKey) {
		return json({ message: 'Missing required fields' }, { status: 400 });
	}

	const storage = await createS3Storage({
		name,
		description,
		endpoint,
		region: region || 'us-east-1',
		bucket,
		accessKey,
		secretKey,
		teamId: locals.team.id
	});

	return json({ data: storage }, { status: 201 });
};
