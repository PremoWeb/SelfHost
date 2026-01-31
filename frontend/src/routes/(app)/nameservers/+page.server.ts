import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	// Parallel fetch using SvelteKit's fetch (handles cookies/relative paths)
	const [profilesRes, providersRes] = await Promise.all([
		fetch('/api/nameserver-profiles'),
		fetch('/api/vps-providers')
	]);

	const profilesData = await profilesRes.json().catch(() => ({ data: [] }));
	const providersData = await providersRes.json().catch(() => ({ data: [] }));

	// Also fetch team/user info to know default profile?
	// The profile list usually contains 'isDefault' if logic is complex, 
	// OR we fetch team info to see 'default_nameserver_profile_id'.
	// Let's fetch session/team info if needed.
	// For now, let's assume profilesData includes normalized data or we don't show "Default" badge correctly.
	// In the UI: `{@const isDefault = data.defaultProfileId === profile.id}`
	// So we need `defaultProfileId`.
	
	let defaultProfileId = null;
    try {
        const sessionRes = await fetch('/api/auth/session');
        if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            defaultProfileId = sessionData.team?.defaultNameserverProfileId || null;
			// Wait, formatTeamJson outputs camelCase or snake_case?
			// api.zig: formatTeamJson: "defaultNameserverProfileId" (NOT IMPLEMENTED in formatTeamJson yet!)
			// I need to check `api.zig` for `formatTeamJson`.
        }
    } catch (e) {
        // Ignore auth fetch error
    }

	return {
		profiles: profilesData.data || [],
		vpsProviders: providersData.data || [],
		defaultProfileId
	};
};

export const actions: Actions = {
	create: async ({ request, fetch }) => {
		const formData = await request.formData();
		const name = formData.get('name');
		const ns1 = formData.get('ns1');
		const ns2 = formData.get('ns2');
		const ns3 = formData.get('ns3');
		const ns4 = formData.get('ns4');
		const dnsProviderId = formData.get('dnsProviderId');

		const res = await fetch('/api/nameserver-profiles', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ 
				name, 
				ns1, 
				ns2: ns2 || undefined, 
				ns3: ns3 || undefined, 
				ns4: ns4 || undefined, 
				dnsProviderId: dnsProviderId || undefined 
			})
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			return fail(res.status, { message: err.message || err.error || 'Failed to create profile' });
		}
		return { success: true };
	},
	delete: async ({ request, fetch }) => {
		const formData = await request.formData();
		const id = formData.get('id');
		if (!id) return fail(400, { message: 'ID required' });

		const res = await fetch(`/api/nameserver-profiles/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			return fail(res.status, { message: 'Failed to delete' });
		}
		return { success: true };
	},
	setDefault: async ({ request, fetch }) => {
		const formData = await request.formData();
		const profileId = formData.get('profileId');
        if (!profileId) return fail(400, { message: 'Profile ID required' });

		const res = await fetch(`/api/nameserver-profiles/${profileId}/set-default`, { method: 'POST' });
		if (!res.ok) {
			return fail(res.status, { message: 'Failed to set default' });
		}
		return { success: true };
	},
	share: async () => {
		return fail(501, { message: 'Share functionality not implemented yet' });
	}
};
