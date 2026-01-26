import { json, error } from '@sveltejs/kit';
import { requireApiAuth, isGod } from '$lib/server/auth/permissions';
import { getServerById } from '$lib/server/services/servers';
import { getVpsProviderById } from '$lib/server/services/vps/providers';
import { VultrService } from '$lib/server/services/vps/vultr';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);
	const userIsGod = locals.user?.id ? await isGod(locals.user.id) : false;

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	if (!locals.team && !userIsGod) {
		return json({ message: 'Team context required' }, { status: 403 });
	}

	const { uuid } = params;
	if (!uuid) {
		return json({ message: 'Server UUID required' }, { status: 400 });
	}

	const server = await getServerById(uuid, locals.team?.id || null);
	if (!server) {
		return json({ message: 'Server not found' }, { status: 404 });
	}

	if (!server.vpsProviderId || server.providerName !== 'Vultr') {
		return json({ message: 'Server is not managed by Vultr' }, { status: 400 });
	}

	const provider = await getVpsProviderById(server.vpsProviderId, locals.team?.id || null);
	if (!provider) {
		return json({ message: 'Provider not found' }, { status: 404 });
	}

	try {
		const vultr = new VultrService(provider.apiKey);
		const instances = await vultr.listInstances();
		const instance = instances.find((i) => i.main_ip === server.ip);

		if (!instance) {
			return json({ message: 'Instance not found in Vultr' }, { status: 404 });
		}

		const [ipv4s, ipv6s] = await Promise.all([
			vultr.getInstanceIpv4(instance.id),
			vultr.getInstanceIpv6(instance.id)
		]);

		return json({
			data: {
				ipv4s: ipv4s.map((ip: any) => ({
					ip: ip.ip,
					reverse: ip.reverse || null
				})),
				ipv6s: ipv6s.map((ip: any) => ({
					ip: ip.ip,
					reverse: ip.reverse || null
				}))
			}
		});
	} catch (err: any) {
		if (err.response?.status === 401 || err.response?.status === 403) {
			return json({ message: 'Cloud Provider Unauthorized: Invalid API key' }, { status: 401 });
		}
		return json({ message: err.message || 'Failed to fetch reverse DNS records' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	await requireApiAuth(locals);
	const userIsGod = locals.user?.id ? await isGod(locals.user.id) : false;

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	if (!locals.team && !userIsGod) {
		return json({ message: 'Team context required' }, { status: 403 });
	}

	const { uuid } = params;
	if (!uuid) {
		return json({ message: 'Server UUID required' }, { status: 400 });
	}

	const server = await getServerById(uuid, locals.team?.id || null);
	if (!server) {
		return json({ message: 'Server not found' }, { status: 404 });
	}

	if (!server.vpsProviderId || server.providerName !== 'Vultr') {
		return json({ message: 'Server is not managed by Vultr' }, { status: 400 });
	}

	const provider = await getVpsProviderById(server.vpsProviderId, locals.team?.id || null);
	if (!provider) {
		return json({ message: 'Provider not found' }, { status: 404 });
	}

	const body = await request.json();
	const { type, ip, reverseDns } = body;

	if (!type || !ip) {
		return json({ message: 'Type and IP are required' }, { status: 400 });
	}

	if (type !== 'ipv4' && type !== 'ipv6') {
		return json({ message: 'Type must be ipv4 or ipv6' }, { status: 400 });
	}

	try {
		const vultr = new VultrService(provider.apiKey);
		const instances = await vultr.listInstances();
		const instance = instances.find((i) => i.main_ip === server.ip);

		if (!instance) {
			return json({ message: 'Instance not found in Vultr' }, { status: 404 });
		}

		if (type === 'ipv4') {
			await vultr.setIpv4ReverseDns(instance.id, ip, reverseDns || '');
		} else {
			await vultr.setIpv6ReverseDns(instance.id, ip, reverseDns || '');
		}

		return json({
			data: {
				success: true,
				message: 'Reverse DNS record updated successfully'
			}
		});
	} catch (err: any) {
		if (err.response?.status === 401 || err.response?.status === 403) {
			return json({ message: 'Cloud Provider Unauthorized: Invalid API key' }, { status: 401 });
		}
		return json({ message: err.message || 'Failed to update reverse DNS record' }, { status: 500 });
	}
};
