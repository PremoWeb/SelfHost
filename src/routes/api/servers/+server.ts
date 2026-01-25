import { json } from '@sveltejs/kit';
import { getServersByTeam, createServer } from '$lib/server/services/servers';
import { requireApiAuth, isGod } from '$lib/server/auth/permissions';
import { getDefaultCompanyForResource } from '$lib/server/services/companies';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	await requireApiAuth(locals);

	if (!locals.team) {
		return json({ data: [] });
	}

	const servers = await getServersByTeam(locals.team.id);
	return json({ data: servers });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireApiAuth(locals);

	const { name, description, ip, port, user, vpsProviderId, privateKeyId, companyId } = await request.json();

	if (!name || !ip) {
		return json({ message: 'Name and IP are required' }, { status: 400 });
	}

	// Determine company assignment: use provided companyId, or default company, or null (god user)
	let assignedCompanyId: string | null = companyId || null;
	if (!assignedCompanyId) {
		// If no company specified, try to get default company
		// If no companies exist, this returns null (indicating god user ownership)
		assignedCompanyId = await getDefaultCompanyForResource();
	}

	// For backward compatibility, still set teamId if available
	const server = await createServer({
		name,
		description,
		ip,
		port: port || 22,
		user: user || 'root',
		teamId: locals.team?.id || null,
		status: 'offline',
		vpsProviderId,
		privateKeyId,
		companyId: assignedCompanyId
	});

	return json({ data: server }, { status: 201 });
};
