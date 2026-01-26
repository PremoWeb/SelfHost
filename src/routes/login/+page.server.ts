import type { PageServerLoad } from './$types';
import { getInstanceSettings } from '$lib/server/services/settings';

export const load: PageServerLoad = async () => {
	const instanceSettings = await getInstanceSettings();
	return {
		websiteMode: instanceSettings?.websiteMode || false
	};
};
