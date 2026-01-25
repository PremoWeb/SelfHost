import { json, error } from '@sveltejs/kit';
import { getVpsProviderById } from '$lib/server/services/vps/providers';
import { VultrService } from '$lib/server/services/vps/vultr';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	await requireApiAuth(locals);
	await requireTeam(locals);

	const providerId = url.searchParams.get('providerId');
	if (!providerId) throw error(400, 'Provider ID required');

	const provider = await getVpsProviderById(providerId, locals.team.id);
	if (!provider || provider.type !== 'vultr') throw error(404, 'Vultr provider not found');

	const vultr = new VultrService(provider.apiKey);
	
	const [regions, plans, os] = await Promise.all([
		vultr.listRegions(),
		vultr.listPlans(),
		vultr.listOs()
	]);

	return json({ regions, plans, os });
};
