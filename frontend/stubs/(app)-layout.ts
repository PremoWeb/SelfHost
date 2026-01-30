import type { LayoutLoad } from './$types';
import { authStore } from '$lib/stores/auth';

export const load: LayoutLoad = async ({ data }) => {
	// Root (app) load: Ensure we have a user to show the UI
	// Zig backend doesn't have auth yet, so we mock a user if needed.
	const user = data.user || {
		id: 'dev-user',
		email: 'dev@selfhost.gg',
		name: 'Dev User',
		emailVerified: true,
		image: null,
		createdAt: new Date(),
		updatedAt: new Date()
	};
	const team = data.team || {
		id: 'dev-team',
		name: 'Dev Team',
		slug: 'dev-team',
		createdAt: new Date(),
		updatedAt: new Date()
	};

	authStore.setUser(user as any, team as any);
	
	return {
		user,
		team,
		teams: data.teams || [team],
		activeCompany: data.activeCompany,
		isGod: true, // Enable all features for dev
		shouldUseAppLayout: true // Tell root layout to show app UI
	};
};
