import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiAuth, isGod } from '$lib/server/auth/permissions';
import { getUserById } from '$lib/server/auth/session';
import { db } from '$lib/server/db/client';
import { teams, companies, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

type ImpersonationType = 'user' | 'team' | 'company';

/**
 * POST /api/users/impersonate
 * Start impersonating a user, team, or company (God only)
 */
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	// Only god users can impersonate
	if (!(await isGod(locals.user.id))) {
		return json({ message: 'Unauthorized' }, { status: 403 });
	}

	const { type, id }: { type: ImpersonationType; id: string } = await request.json();

	if (!type || !id) {
		return json({ message: 'Type and ID are required' }, { status: 400 });
	}

	if (!['user', 'team', 'company'].includes(type)) {
		return json({ message: 'Invalid impersonation type' }, { status: 400 });
	}

	let targetEntity: any = null;
	let entityName = '';

	if (type === 'user') {
		// User impersonation should now use Better Auth's admin plugin
		// This endpoint is kept for backward compatibility, but we recommend using authClient.admin.impersonateUser()
		return json({ message: 'User impersonation should use Better Auth admin plugin. Use authClient.admin.impersonateUser() instead.' }, { status: 400 });
	} else if (type === 'team') {
		const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
		if (!team) {
			return json({ message: 'Team not found' }, { status: 404 });
		}
		targetEntity = team;
		entityName = team.name;
	} else if (type === 'company') {
		const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
		if (!company) {
			return json({ message: 'Company not found' }, { status: 404 });
		}
		targetEntity = company;
		entityName = company.name;
	}

	// Store impersonation state in cookies
	cookies.set('impersonated_type', type, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 // 24 hours
	});

	cookies.set('impersonated_id', id, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 // 24 hours
	});

	cookies.set('impersonated_by', locals.user.id, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 // 24 hours
	});

	return json({
		data: {
			type,
			entity: {
				id: targetEntity.id,
				name: entityName
			},
			impersonatedBy: {
				id: locals.user.id,
				name: locals.user.name,
				email: locals.user.email
			}
		}
	});
};

/**
 * DELETE /api/users/impersonate
 * Stop impersonating and return to God user
 */
export const DELETE: RequestHandler = async ({ locals, cookies }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	// Clear impersonation cookies
	cookies.delete('impersonated_type', { path: '/' });
	cookies.delete('impersonated_id', { path: '/' });
	cookies.delete('impersonated_by', { path: '/' });
	// Clear old cookie names for backward compatibility
	cookies.delete('impersonated_user_id', { path: '/' });

	return json({ message: 'Impersonation stopped' });
};
