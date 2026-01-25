import type { LayoutLoad } from './$types';
import { authStore } from '$lib/stores/auth';

export const load: LayoutLoad = async ({ data }) => {
	if (data?.user) {
		// Update auth store with data from server
		authStore.setUser(data.user, data.team as any);
	} else {
		authStore.setLoading(false);
	}
	
	return {
		user: data.user,
		team: data.team,
		teams: data.teams
	};
};
