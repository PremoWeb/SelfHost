import { error, fail } from '@sveltejs/kit';
import { getServerById } from '$lib/server/services/servers';
import { getVpsProvidersByTeam, getVpsProviderById } from '$lib/server/services/vps/providers';
import { VultrService } from '$lib/server/services/vps/vultr';
import { getPrivateKeysByTeam, createPrivateKey, generateKeyPair, getPrivateKeysByOwner, getPrivateKeyById } from '$lib/server/services/security';
import { updateServer } from '$lib/server/services/servers';
import { installAgent } from '$lib/server/services/agent';
import { agentManager } from '$lib/server/agent/manager';
import { updateProxySettings, generateTraefikConfig } from '$lib/server/services/proxy';
import { Client } from 'ssh2';
import { requireAuth, isGod } from '$lib/server/auth/permissions';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const serverId = params.id;

	await requireAuth(locals);
	
	// God users can access any server, others need a team
    const isGodUser = await isGod(locals.user!.id);
	if (!locals.team && !isGodUser) {
		throw error(400, 'Team required to view server');
	}

	const server = await getServerById(serverId, locals.team?.id || null);
	const vpsProviders = locals.team ? await getVpsProvidersByTeam(locals.team.id) : [];
	
    let privateKeys: any[] = [];
    if (server?.teamId) {
        // Fetch keys for the server's team
        privateKeys = await getPrivateKeysByTeam(server.teamId, false);
    } else if (server?.ownerType && server?.ownerId) {
        // Fetch keys for the server's owner (individual/company)
        privateKeys = await getPrivateKeysByOwner(server.ownerType, server.ownerId);
    }

    // Ensure the currently assigned key is always included in the list
    if (server?.privateKeyId && !privateKeys.find(k => k.id === server.privateKeyId)) {
        const assignedKey = await getPrivateKeyById(server.privateKeyId, null, true);
        if (assignedKey) {
            privateKeys.push(assignedKey);
        }
    }

	if (!server) {
		throw error(404, 'Server not found');
	}

	// Get domains that can be used with this server
	// This includes:
	// 1. DNS records with syncMode='server' pointing to this server
	// 2. DNS records with syncMode='tag' where the tag matches one of this server's tags
	// 3. DNS records with syncMode='static' pointing to this server's IP
	const { db } = await import('$lib/server/db/client');
	const { domains, dnsRecords, cloudflareAccessTokens } = await import('$lib/server/db/schema');
	const { eq, and, or, inArray, sql } = await import('drizzle-orm');
	
	const serverTags = server.tags || [];
	
	const availableDomains = await db
		.select({
			id: domains.id,
			domain: domains.name,
			recordName: dnsRecords.name,
			recordValue: dnsRecords.value,
			syncMode: dnsRecords.syncMode,
			syncTag: dnsRecords.syncTag
		})
		.from(domains)
		.innerJoin(dnsRecords, eq(dnsRecords.domainId, domains.id))
		.where(
			and(
				locals.team ? eq(domains.teamId, locals.team.id) : sql`1=1`, // God users see all domains
				or(
					// Records synced to this specific server
					and(
						eq(dnsRecords.syncMode, 'server'),
						eq(dnsRecords.serverId, server.id)
					),
					// Records synced to a tag that this server has
					...(serverTags.length > 0 ? [
						and(
							eq(dnsRecords.syncMode, 'tag'),
							inArray(dnsRecords.syncTag, serverTags)
						)
					] : []),
					// Static records pointing to this server's IP
					and(
						eq(dnsRecords.syncMode, 'static'),
						eq(dnsRecords.value, server.ip)
					)
				)
			)
		);

	// Get deployed apps from quick_deploy_apps table
	const { quickDeployApps } = await import('$lib/server/db/schema');
	
	const deployedApps = await db.query.quickDeployApps.findMany({
		where: eq(quickDeployApps.serverId, serverId),
		orderBy: (quickDeployApps, { desc }) => [desc(quickDeployApps.deployedAt)]
	});

	// Check for active tunnel in dev mode
	const { getTunnelUrl } = await import('$lib/server/services/tunnel');
	const tunnelUrl = await getTunnelUrl();
	
	const { getLocalAgentChecksum, getLocalAgentVersion } = await import('$lib/server/services/agent');
	const localAgentChecksum = await getLocalAgentChecksum();
	const localAgentVersion = await getLocalAgentVersion();

	const accessTokens = await db.query.cloudflareAccessTokens.findMany({
		where: locals.team ? eq(cloudflareAccessTokens.teamId, locals.team.id) : undefined
	});

	return {
		server,
		vpsProviders,
		privateKeys,
		availableDomains,
		deployedApps,
		tunnelUrl,
		localAgentChecksum,
		localAgentVersion,
		accessTokens
	};
};
export const actions: Actions = {
	retrievePassword: async ({ params, locals }) => {
		const serverId = params.id;
		await requireAuth(locals);

		// God users can access any server, others need a team
		const isGodUser = await isGod(locals.user!.id);
		if (!locals.team && !isGodUser) {
			return fail(403, { message: 'Team required to view server' });
		}

		const server = await getServerById(serverId, locals.team?.id || null);
		if (!server) return fail(404, { message: 'Server not found' });

		if (!server.vpsProviderId) {
			return fail(400, { message: 'Server is not linked to a cloud provider' });
		}

		const provider = await getVpsProviderById(server.vpsProviderId, locals.team?.id || null);
		if (!provider) return fail(404, { message: 'Provider not found' });

		try {
			if (provider.type === 'vultr') {
				const service = new VultrService(provider.apiKey);
				const instances = await service.listInstances();
				const instanceSummary = instances.find((i) => i.main_ip === server.ip);

				if (!instanceSummary) {
					return fail(404, { message: 'Server instance not found in provider account' });
				}

				// Fetch full details to get password
				const instance = await service.getInstance(instanceSummary.id);
				console.log('Vultr Instance Details:', JSON.stringify(instance, null, 2));

				if (instance && instance.default_password) {
					return { 
						success: true, 
						password: instance.default_password,
						message: 'Password retrieved from provider' 
					};
				} else {
					return fail(404, { message: 'Provider did not return a password. This is common if the server was deployed using SSH keys.' });
				}
			}
			
			return fail(400, { message: `Provider type ${provider.type} not supported for password retrieval` });
		} catch (err: any) {
			if (err.response?.status === 401 || err.response?.status === 403) {
				return fail(401, { message: `Cloud Provider Unauthorized: The API key for ${provider.name} appears to be invalid, expired, or deactivated.` });
			}
			return fail(500, { message: err.message || 'Failed to retrieve password' });
		}
	},
	reinstall: async ({ params, locals }) => {
		const serverId = params.id;
		await requireAuth(locals);

		// God users can access any server, others need a team
		const isGodUser = await isGod(locals.user!.id);
		if (!locals.team && !isGodUser) {
			return fail(403, { message: 'Team required to manage server' });
		}

		const server = await getServerById(serverId, locals.team?.id || null);
		if (!server) return fail(404, { message: 'Server not found' });

		if (!server.vpsProviderId) {
			return fail(400, { message: 'Server is not linked to a cloud provider' });
		}

		const provider = await getVpsProviderById(server.vpsProviderId, locals.team?.id || null);
		if (!provider) return fail(404, { message: 'Provider not found' });

		try {
			if (provider.type === 'vultr') {
				const service = new VultrService(provider.apiKey);
				const instances = await service.listInstances();
				const instanceSummary = instances.find((i) => i.main_ip === server.ip);

				if (!instanceSummary) {
					return fail(404, { message: 'Server instance not found in provider account' });
				}

				// 1. Generate new SSH Key
				const { privateKey, publicKey } = generateKeyPair();
				const keyName = `selfhost-${server.name}-${Date.now().toString().slice(-4)}`;

				// 2. Save to local DB
				const savedKey = await createPrivateKey({
					name: keyName,
					description: `Auto-generated for ${server.name} reinstall`,
					privateKey: privateKey,
					teamId: locals.team?.id || null,
					ownerType: locals.team ? 'team' : 'user', // Default to user if no team (God mode)
					ownerId: locals.team?.id || locals.user!.id
				});

				// 3. Register with Vultr
				const vultrKey = await service.createSshKey(keyName, publicKey);

				// 4. Update Instance to use new key
				// Vultr requires updating the instance with the key ID before reinstalling
				// This ensures the reinstall process applies this specific key
				await service.updateInstance(instanceSummary.id, {
					sshkey_id: [vultrKey.id]
				});

				// 5. Trigger Reinstall
				await service.reinstallInstance(instanceSummary.id);
				
				// 6. Update local server record
				await updateServer(server.id, locals.team?.id || null, { 
					status: 'reinstalling',
					privateKeyId: savedKey.id
				});

				return { success: true, message: 'Reinstall started with new secure SSH key' };
			}
			
			return fail(400, { message: `Provider type ${provider.type} not supported for reinstall` });
		} catch (err: any) {
			if (err.response?.status === 401 || err.response?.status === 403) {
				return fail(401, { message: `Cloud Provider Unauthorized: The API key for ${provider.name} appears to be invalid, expired, or deactivated.` });
			}
			return fail(500, { message: err.message || 'Failed to reinstall server' });
		}
	}
};




