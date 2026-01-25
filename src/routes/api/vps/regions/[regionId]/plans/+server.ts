import { json } from '@sveltejs/kit';
import { getVpsProviderById } from '$lib/server/services/vps/providers';
import { VultrService } from '$lib/server/services/vps/vultr';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	await requireApiAuth(locals);
	await requireTeam(locals);

	const providerId = url.searchParams.get('providerId');
	if (!providerId) {
		return json({ error: 'Provider ID required' }, { status: 400 });
	}

	const provider = await getVpsProviderById(providerId, locals.team.id);
	if (!provider) {
		return json({ error: 'Provider not found' }, { status: 404 });
	}

	if (provider.type !== 'vultr') {
		return json({ error: 'Only Vultr providers supported' }, { status: 400 });
	}

	try {
		const vultr = new VultrService(provider.apiKey);
		
		// Get available plan IDs for this region
		const availablePlanIds = await vultr.listAvailablePlansForRegion(params.regionId);
		
		// Get all plans
		const allPlans = await vultr.listPlans();
		
		// Filter plans to only include those available in this region
		const plans = allPlans.filter(plan => availablePlanIds.includes(plan.id));
		
		return json({ plans });
	} catch (error: any) {
		return json({ error: error.message || 'Failed to fetch plans' }, { status: 500 });
	}
};
