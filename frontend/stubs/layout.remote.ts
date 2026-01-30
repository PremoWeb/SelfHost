/**
 * Frontend stub for (app) layout.remote — calls Zig API instead of SvelteKit server.
 * Zig may not implement all auth/session endpoints yet; these return or forward to /api.
 */
async function apiPost(path: string, body: object) {
	const res = await fetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(body)
	});
	const data = await res.json().catch(() => ({}));
	return { success: res.ok, ...data };
}

export const impersonateUser = async ({ userId }: { userId: string }) =>
	apiPost('/api/auth/admin/impersonate-user', { userId });

export const stopImpersonating = async () =>
	apiPost('/api/auth/admin/stop-impersonating', {});

export const switchTeam = async ({ teamId }: { teamId: string }) =>
	apiPost('/api/auth/session/team', { teamId });

export const switchCompany = async ({ companyId }: { companyId: string }) =>
	apiPost('/api/auth/session/company', { companyId });
