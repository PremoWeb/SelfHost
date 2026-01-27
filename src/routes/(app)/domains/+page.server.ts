import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { domains, dnsRecords, nameserverProfiles, servers, domainShares, users, teams, companies } from '$lib/server/db/schema';
import { eq, or } from 'drizzle-orm';
import { createDomain, deleteDomain } from '$lib/server/services/domains';
import { getVpsProvidersByTeam } from '$lib/server/services/vps/providers';
import { VultrService } from '$lib/server/services/vps/vultr';
import type { PageServerLoad } from './$types';

import { requireAuth, requireTeam, isGod } from '$lib/server/auth/permissions';
import { getDefaultCompanyForResource } from '$lib/server/services/companies';

export const load: PageServerLoad = async ({ locals }) => {
	await requireAuth(locals);

    const isGodUser = await isGod(locals.user!.id);
	if (!locals.team && !isGodUser) {
		return {
			domains: [],
			nameserverProfiles: [],
			vultrDomains: [],
			vultrProvider: null,
			servers: [],
			tags: []
		};
	}

    const teamId = locals.team?.id;

    // Fetch domains: Filter by team if present, otherwise fetch all for God users
    // Note: In a real multi-tenant app, God users might still want a filter, but this matches the request "show us all domains available"
	const domainsList = await db.query.domains.findMany({
		where: teamId ? or(eq(domains.teamId, teamId), eq(domains.ownerId, teamId)) : undefined,
		with: {
			nameserverProfile: true,
			shares: true
		},
		orderBy: (domains, { asc }) => [asc(domains.name)]
	});

	// Fetch all potential assignees for the sharing modal
	const [allUsersList, allTeamsList, allCompaniesList] = await Promise.all([
		db.select({ id: users.id, name: users.name }).from(users),
		db.select({ id: teams.id, name: teams.name }).from(teams),
		db.select({ id: companies.id, name: companies.name }).from(companies)
	]);


	const profiles = await db.query.nameserverProfiles.findMany({
		where: teamId ? eq(nameserverProfiles.teamId, teamId) : undefined,
		orderBy: (nameserverProfiles, { asc }) => [asc(nameserverProfiles.name)]
	});

    // Use our updated service that handles null teamId for God mode
	const providers = await getVpsProvidersByTeam(teamId);
	
	let vultrDomains: any[] = [];
	const vultrProvider = providers.find(p => p.type === 'vultr');
	
	if (vultrProvider) {
		try {
			const vultr = new VultrService(vultrProvider.apiKey);
			vultrDomains = await vultr.listDomains();
		} catch (err) {
		}
	}

	// Get all servers for IP selection
	const teamServers = await db.query.servers.findMany({
		where: teamId ? eq(servers.teamId, teamId) : undefined,
		orderBy: (servers, { asc }) => [asc(servers.name)]
	});

	// Get unique tags
	const allTags = Array.from(
		new Set(teamServers.flatMap(s => s.tags || []))
	).sort();

	return {
		domains: domainsList,
		nameserverProfiles: profiles,
		vultrDomains,
		vultrProvider,
		servers: teamServers,
		tags: allTags,
		allUsers: allUsersList,
		allTeams: allTeamsList,
		allCompanies: allCompaniesList
	};
};

export const actions = {
	create: async ({ request, locals }) => {
		await requireAuth(locals);
		if (!locals.team && !(await isGod(locals.user!.id))) {
			return { success: false, error: 'Team required for this operation' };
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const provider = formData.get('provider') as string;
		const nameserverProfileId = formData.get('nameserverProfileId') as string | null;
		const companyId = formData.get('companyId') as string | null;

		if (!name || !provider) {
			return { success: false, error: 'Missing required fields' };
		}

		// Determine company assignment: use provided companyId, or default company, or null (god user)
		let assignedCompanyId: string | null = companyId || null;
		if (!assignedCompanyId) {
			assignedCompanyId = await getDefaultCompanyForResource();
		}

		const newDomain = await createDomain({
			name,
			provider,
			nameserverProfileId: nameserverProfileId || null,
			teamId: locals.team?.id || null,
			companyId: assignedCompanyId
		});

		if (provider === 'vultr') {
			try {
				const providers = await getVpsProvidersByTeam(locals.team.id);
				const vultrProvider = providers.find(p => p.type === 'vultr');

				if (vultrProvider?.apiKey) {
					const vultr = new VultrService(vultrProvider.apiKey);
					const records = await vultr.listRecords(name);

					if (records && records.length > 0) {
						const recordsToInsert = records.map((r: any) => ({
							domainId: newDomain.id,
							type: r.type,
							name: r.name === '' ? '@' : r.name,
							value: r.data,
							ttl: r.ttl,
							priority: r.priority,
							syncMode: 'static' as const,
							teamId: locals.team!.id
						}));

						await db.insert(dnsRecords).values(recordsToInsert);
					}
				}
			} catch (err) {
			}
		}

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		await requireAuth(locals);
		if (!locals.team) {
			return { success: false, error: 'Team required for this operation' };
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const deleteFromProvider = formData.get('deleteFromProvider') === 'true';

		if (!id) return { success: false, error: 'Missing ID' };

		// Get domain info before deleting
		const domain = await db.query.domains.findFirst({
			where: eq(domains.id, id)
		});

		// Delete from Premo database
		await deleteDomain(id, locals.team.id);

		// Also delete from Vultr if requested
		if (deleteFromProvider && domain?.provider === 'vultr') {
			try {
				const providers = await getVpsProvidersByTeam(locals.team.id);
				const vultrProvider = providers.find(p => p.type === 'vultr');

				if (vultrProvider?.apiKey) {
					const vultr = new VultrService(vultrProvider.apiKey);
					await vultr.deleteDomain(domain.name);
				}
			} catch (err) {
				// Don't fail the whole operation
			}
		}

		return { success: true };
	},

	createOnProvider: async ({ request, locals }) => {
		await requireAuth(locals);
		if (!locals.team) {
			return { success: false, error: 'Team required for this operation' };
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const ipSource = formData.get('ipSource') as 'manual' | 'server' | 'tag';
		const manualIp = formData.get('manualIp') as string | null;
		const serverId = formData.get('serverId') as string | null;
		const tag = formData.get('tag') as string | null;

		if (!name) {
			return { success: false, error: 'Domain name is required' };
		}

		try {
			const providers = await getVpsProvidersByTeam(locals.team.id);
			const vultrProvider = providers.find(p => p.type === 'vultr');

			if (!vultrProvider?.apiKey) {
				return { success: false, error: 'Vultr provider not configured' };
			}

			const vultr = new VultrService(vultrProvider.apiKey);
			
			// Determine which IPs to use
			let ipsToCreate: { ip: string; type: 'A' | 'AAAA' }[] = [];

			if (ipSource === 'manual' && manualIp) {
				// Manual IP entry
				const isIPv6 = manualIp.includes(':');
				ipsToCreate.push({ ip: manualIp, type: isIPv6 ? 'AAAA' : 'A' });
			} else if (ipSource === 'server' && serverId) {
				// Single server
				const server = await db.query.servers.findFirst({
					where: eq(servers.id, serverId)
				});
				if (server?.ip) {
					const isIPv6 = server.ip.includes(':');
					ipsToCreate.push({ ip: server.ip, type: isIPv6 ? 'AAAA' : 'A' });
				}
			} else if (ipSource === 'tag' && tag) {
				// All servers with tag
				const taggedServers = await db.query.servers.findMany({
					where: eq(servers.teamId, locals.team.id)
				});
				
				for (const server of taggedServers) {
					if (server.tags?.includes(tag) && server.ip) {
						const isIPv6 = server.ip.includes(':');
						ipsToCreate.push({ ip: server.ip, type: isIPv6 ? 'AAAA' : 'A' });
					}
				}
			}

			// Create domain on Vultr (with first IP if available)
			const firstIp = ipsToCreate.length > 0 ? ipsToCreate[0].ip : undefined;
			await vultr.createDomain(name, firstIp);

			// Create additional A/AAAA records for remaining IPs
			for (let i = 1; i < ipsToCreate.length; i++) {
				const { ip, type } = ipsToCreate[i];
				try {
					await vultr.createRecord(name, {
						type,
						name: '',  // @ record
						data: ip,
						ttl: 3600
					});
				} catch (err) {
				}
			}

			// Import into Premo
			const newDomain = await createDomain({
				name,
				provider: 'vultr',
				nameserverProfileId: null,
				teamId: locals.team.id
			});

			// Sync DNS records from Vultr
			const records = await vultr.listRecords(name);
			if (records && records.length > 0) {
				const recordsToInsert = records.map((r: any) => ({
					domainId: newDomain.id,
					type: r.type,
					name: r.name === '' ? '@' : r.name,
					value: r.data,
					ttl: r.ttl,
					priority: r.priority,
					syncMode: 'static' as const,
					teamId: locals.team!.id
				}));

				await db.insert(dnsRecords).values(recordsToInsert);
			}

			return { success: true, domainId: newDomain.id };
		} catch (err: any) {
			
			// Extract error message from Vultr API response
			let errorMessage = 'Failed to create domain on provider';
			
			if (err.response?.data?.error) {
				// Vultr API error format: { error: "message", status: 400 }
				errorMessage = err.response.data.error;
			} else if (err.message) {
				errorMessage = err.message;
			}
			
			return { success: false, error: errorMessage };
		}
	},

	updateShares: async ({ request, locals }) => {
		await requireAuth(locals);
		const formData = await request.formData();
		const domainId = formData.get('domainId') as string;
		const sharesData = formData.get('shares') as string; // JSON array of { assigneeType, assigneeId, role }

		if (!domainId) return { success: false, error: 'Missing domain ID' };

		const parsedShares = JSON.parse(sharesData);

		// Delete existing shares
		await db.delete(domainShares).where(eq(domainShares.domainId, domainId));

		// Insert new shares if any
		if (parsedShares.length > 0) {
			await db.insert(domainShares).values(
				parsedShares.map((s: any) => ({
					domainId,
					assigneeType: s.assigneeType,
					assigneeId: s.assigneeId,
					role: s.role || 'use'
				}))
			);
		}

		return { success: true };
	},

	updateOwner: async ({ request, locals }) => {
		await requireAuth(locals);
		const formData = await request.formData();
		const domainId = formData.get('domainId') as string;
		const ownerType = formData.get('ownerType') as string;
		const ownerId = formData.get('ownerId') as string;

		if (!domainId) return { success: false, error: 'Missing domain ID' };

		await db.update(domains)
			.set({ ownerType, ownerId })
			.where(eq(domains.id, domainId));

		return { success: true };
	}
};

