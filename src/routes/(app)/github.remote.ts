import { command, getRequestEvent } from '$app/server';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import { db } from '$lib/server/db';
import { sources } from '$lib/server/db/schema';

// Temporary in-memory storage for pending GitHub App registrations
// In production, use Redis or a database table with TTL
const pendingApps = new Map<string, { appData: any; expiresAt: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of pendingApps.entries()) {
        if (data.expiresAt < now) {
            pendingApps.delete(token);
        }
    }
}, 5 * 60 * 1000);

export const completeGitHubApp = command('unchecked', async ({ token }: { token: string }) => {
	const { locals } = getRequestEvent();
	await requireApiAuth(locals);
	await requireTeam(locals);

	const pending = pendingApps.get(token);

	if (!pending || pending.expiresAt < Date.now()) {
		return { success: false, message: 'Invalid or expired token' };
	}

	const { appData } = pending;
	pendingApps.delete(token);

	try {
		// Store the GitHub App
		await db.insert(sources).values({
			name: appData.name,
			description: `GitHub App: ${appData.name}`,
			type: 'github',
			apiUrl: 'https://api.github.com',
			htmlUrl: appData.html_url,
			isApp: true,
			appId: appData.id.toString(),
			clientId: appData.client_id,
			clientSecret: appData.client_secret,
			privateKey: appData.pem,
			webhookSecret: appData.webhook_secret,
			teamId: locals.team.id
		});

		return { success: true };
	} catch (err: any) {
		return { success: false, message: err.message || 'Failed to complete GitHub App registration' };
	}
});
