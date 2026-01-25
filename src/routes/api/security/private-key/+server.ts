import { json } from '@sveltejs/kit';
import { getPrivateKeysByTeam, createPrivateKey } from '$lib/server/services/security';
import { requireApiAuth, isGod } from '$lib/server/auth/permissions';
import { getDefaultCompanyForResource } from '$lib/server/services/companies';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	await requireApiAuth(locals);

	if (!locals.team) {
		return json({ data: [] });
	}

	const keys = await getPrivateKeysByTeam(locals.team.id);
	return json({ data: keys });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireApiAuth(locals);

	const { name, description, privateKey, companyId } = await request.json();

	if (!name || !privateKey) {
		return json({ message: 'Name and Private Key are required' }, { status: 400 });
	}

	// Determine company assignment: use provided companyId, or default company, or null (god user)
	let assignedCompanyId: string | null = companyId || null;
	if (!assignedCompanyId) {
		assignedCompanyId = await getDefaultCompanyForResource();
	}

	const key = await createPrivateKey({
		name,
		description,
		privateKey,
		teamId: locals.team?.id || null,
		companyId: assignedCompanyId
	});

	return json({ data: key }, { status: 201 });
};
