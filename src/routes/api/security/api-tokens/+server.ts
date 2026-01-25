import { json } from '@sveltejs/kit';
import { getApiTokensByTeam, createApiToken } from '$lib/server/services/api-tokens';
import { requireApiAuth, isGod } from '$lib/server/auth/permissions';
import { getDefaultCompanyForResource } from '$lib/server/services/companies';
import type { RequestHandler } from './$types';
import crypto from 'crypto';

export const GET: RequestHandler = async ({ locals }) => {
	await requireApiAuth(locals);

	if (!locals.team) {
		return json({ data: [] });
	}

	const tokens = await getApiTokensByTeam(locals.team.id);
	// We mask the tokens in the list response
	const maskedTokens = tokens.map(t => ({
		...t,
		token: `${t.token.substring(0, 5)}...${t.token.substring(t.token.length - 5)}`
	}));

	return json({ data: maskedTokens });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireApiAuth(locals);

	const { name, description, companyId } = await request.json();

	if (!name) {
		return json({ message: 'Name is required' }, { status: 400 });
	}

	// Determine company assignment: use provided companyId, or default company, or null (god user)
	let assignedCompanyId: string | null = companyId || null;
	if (!assignedCompanyId) {
		assignedCompanyId = await getDefaultCompanyForResource();
	}

	// Generate a simpler token format: cooler-[random-hex]
	const tokenString = `cooler-${crypto.randomBytes(24).toString('hex')}`;

	const token = await createApiToken({
		name,
		description,
		token: tokenString,
		teamId: locals.team?.id || null,
		companyId: assignedCompanyId
	});

	// Return the FULL token string only here
	return json({ data: token }, { status: 201 });
};
