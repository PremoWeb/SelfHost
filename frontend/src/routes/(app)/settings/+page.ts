import type { PageLoad } from './$types';
import { api } from '$lib/api/client';

const defaultSettings = {
	fqdn: '',
	registrationEnabled: true,
	doNotTrack: false,
	instanceId: ''
};

export const load: PageLoad = async () => {
	let settings: Record<string, unknown> = { ...defaultSettings };
	try {
		const res = await api.get<{ data?: Record<string, unknown> }>('/settings');
		if (res.data?.data && typeof res.data.data === 'object' && !Array.isArray(res.data.data)) {
			settings = { ...defaultSettings, ...res.data.data };
		}
	} catch {
		// use default when API not available or errors
	}
	return { settings };
};
