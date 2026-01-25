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
	const [instances, sshKeys] = await Promise.all([
		vultr.listInstances(),
		vultr.listSshKeys()
	]);

	return json({ instances, sshKeys });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireApiAuth(locals);
	await requireTeam(locals);

	const { providerId, region, plan, os_id, label } = await request.json();
	if (!providerId) throw error(400, 'Provider ID required');

	const provider = await getVpsProviderById(providerId, locals.team.id);
	if (!provider || provider.type !== 'vultr') throw error(404, 'Vultr provider not found');

	const vultr = new VultrService(provider.apiKey);
	const instance = await vultr.createInstance({ region, plan, os_id, label });

	return json(instance);
};
