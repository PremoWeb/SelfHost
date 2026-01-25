import { command, getRequestEvent } from '$app/server';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import { getVpsProviderById } from '$lib/server/services/vps/providers';
import { VultrService } from '$lib/server/services/vps/vultr';

export const getVpsPlans = command('unchecked', async ({ regionId, providerId }: { regionId: string; providerId: string }) => {
	const { locals } = getRequestEvent();
	await requireApiAuth(locals);
	await requireTeam(locals);

	if (!providerId) {
		return { success: false, message: 'Provider ID required' };
	}

	const provider = await getVpsProviderById(providerId, locals.team.id);
	if (!provider) {
		return { success: false, message: 'Provider not found' };
	}

	if (provider.type !== 'vultr') {
		return { success: false, message: 'Only Vultr providers supported' };
	}

	try {
		const vultr = new VultrService(provider.apiKey);
		
		// Get available plan IDs for this region
		const availablePlanIds = await vultr.listAvailablePlansForRegion(regionId);
		
		// Get all plans
		const allPlans = await vultr.listPlans();
		
		// Filter plans to only include those available in this region
		const plans = allPlans.filter(plan => availablePlanIds.includes(plan.id));
		
		return { success: true, data: { plans } };
	} catch (error: any) {
		return { success: false, message: error.message || 'Failed to fetch plans' };
	}
});
