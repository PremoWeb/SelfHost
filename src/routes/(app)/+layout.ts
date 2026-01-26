import type { LayoutLoad } from './$types';
import { authStore } from '$lib/stores/auth';

export const load: LayoutLoad = async ({ data }) => {
	if (data?.user) {
		// Update auth store with data from server
		// Type assertion needed because server User type has different fields than client User type
		authStore.setUser(data.user as any, data.team as any);
	} else {
		authStore.setLoading(false);
	}
	
	return {
		user: data.user,
		team: data.team,
		teams: data.teams
	};
};
