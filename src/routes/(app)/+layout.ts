import type { LayoutLoad } from './$types';
import { authStore } from '$lib/stores/auth';

export const load: LayoutLoad = async ({ data }) => {
	if (data?.user) {
		// Update auth store with data from server
		authStore.setUser(data.user as any, data.team as any);
	} else {
		authStore.setLoading(false);
	}
	// Pass through all server layout data so Sidebar/ContextSwitcher get companies, users, isGod, etc.
	return { ...data };
};
