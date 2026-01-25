import { error, redirect, fail } from '@sveltejs/kit';
import { getVpsProviderById } from '$lib/server/services/vps/providers';
import { VultrService, type VultrPlan } from '$lib/server/services/vps/vultr';
import { getPrivateKeysByTeam, getPrivateKeyById } from '$lib/server/services/security';
import { getVpsTemplates, createVpsTemplate, deleteVpsTemplate } from '$lib/server/services/vps/templates';
import { getServersByTeam } from '$lib/server/services/servers';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { writeFileSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { PageServerLoad } from './$types';

import { requireAuth, isGod } from '$lib/server/auth/permissions';

export const load: PageServerLoad = async ({ params, locals }) => {
	await requireAuth(locals);
	
	// God users can access this page but won't have a team
	// Regular users need a team
	if (!locals.team && !(await isGod(locals.user!.id))) {
		throw error(400, 'Team required');
	}

	const provider = await getVpsProviderById(params.id, locals.team?.id);
	if (!provider) throw error(404, 'Provider not found');

	let instances: any[] = [];
	let meta = { regions: [] as any[], plans: [] as VultrPlan[], os: [] as any[] };
	let providerSshKeys: any[] = [];

	if (provider.type === 'vultr') {
		try {
			const vultr = new VultrService(provider.apiKey);
			[instances, meta.regions, meta.plans, meta.os, providerSshKeys] = await Promise.all([
				vultr.listInstances(),
				vultr.listRegions(),
				vultr.listPlans(),
				vultr.listOs(),
				vultr.listSshKeys()
			]);
		} catch (err) {
		}
	}

	const teamPrivateKeys = await getPrivateKeysByTeam(locals.team?.id);
	const templates = await getVpsTemplates(locals.team?.id, provider.id);
	const servers = await getServersByTeam(locals.team?.id);


	return {
		provider,
		instances,
		meta,
		providerSshKeys,
		teamPrivateKeys,
		templates,
		servers
	};
};

export const actions = {
	deploy: async ({ request, params, locals }) => {
		await requireAuth(locals);
		const isGodUser = await isGod(locals.user!.id);
		if (!locals.team && !isGodUser) {
			return fail(400, { error: 'Team required for this operation' });
		}

		const provider = await getVpsProviderById(params.id, locals.team?.id);
		if (!provider) throw error(404, 'Provider not found');

		const formData = await request.formData();
		const label = formData.get('label') as string;
		const region = formData.get('region') as string;
		const plan = formData.get('plan') as string;
		const osId = formData.get('osId') as string;
		const sshKeys = formData.getAll('sshKeys') as string[];

		try {
			const vultr = new VultrService(provider.apiKey);
			
			await vultr.createInstance({
				label,
				region,
				plan,
				os_id: parseInt(osId),
				sshkey_ids: sshKeys.filter(Boolean)
			});

			return { success: true };
		} catch (err: any) {
			
			// Extract Vultr API error message if available
			const errorMessage = err.response?.data?.error || err.message || 'Failed to deploy VPS';
			
			return fail(400, { error: errorMessage });
		}
	},

	saveTemplate: async ({ request, params, locals }) => {
		await requireAuth(locals);
		if (!locals.team) {
			return fail(400, { error: 'Team required for this operation' });
		}

		const provider = await getVpsProviderById(params.id, locals.team.id);
		if (!provider) throw error(404, 'Provider not found');

		const formData = await request.formData();
		const name = formData.get('templateName') as string;
		const description = formData.get('templateDescription') as string;
		const region = formData.get('region') as string;
		const plan = formData.get('plan') as string;
		const osId = formData.get('osId') as string;
		const sshKeys = formData.getAll('sshKeys') as string[];


		try {
			const template = await createVpsTemplate({
				name,
				description,
				region,
				plan,
				osId: parseInt(osId),
				sshKeyIds: sshKeys.filter(Boolean),
				vpsProviderId: provider.id,
				teamId: locals.team.id
			});


			return { success: true };
		} catch (err: any) {
			
			const errorMessage = err.response?.data?.error || err.message || 'Failed to save template';
			
			return fail(400, { error: errorMessage });
		}
	},

	deleteTemplate: async ({ request, params, locals }) => {
		await requireAuth(locals);
		if (!locals.team) {
			return fail(400, { error: 'Team required for this operation' });
		}

		const formData = await request.formData();
		const templateId = formData.get('templateId') as string;

		try {
			await deleteVpsTemplate(templateId, locals.team.id);
			return { success: true };
		} catch (err: any) {
			
			const errorMessage = err.response?.data?.error || err.message || 'Failed to delete template';
			
			return fail(400, { error: errorMessage });
		}
	},

	installKey: async ({ request, params, locals }) => {
		await requireAuth(locals);
		const isGodUser = await isGod(locals.user!.id);
		
		if (!locals.team && !isGodUser) {
			return fail(400, { error: 'Team required for this operation' });
		}

		const provider = await getVpsProviderById(params.id, locals.team?.id);
		if (!provider) throw error(404, 'Provider not found');

		const formData = await request.formData();
		const privateKeyId = formData.get('privateKeyId') as string;


		const keyRecord = await getPrivateKeyById(privateKeyId, locals.team?.id || null, isGodUser);
		if (!keyRecord) throw error(404, 'Private key not found');

		try {
			// Using ssh-keygen to derive the public key in OpenSSH format from the private key
			// This is more reliable than node:crypto across different runtimes (Bun/Node)
			const tmpDir = mkdtempSync(join(tmpdir(), 'selfhost-ssh-'));
			const keyPath = join(tmpDir, 'id_rsa');
			writeFileSync(keyPath, keyRecord.privateKey, { mode: 0o600 });
			
			let openSshPublicKey: string;
			try {
				openSshPublicKey = execSync(`ssh-keygen -y -f ${keyPath}`).toString().trim();
			} catch (e: any) {
				throw new Error('Failed to derive public key using ssh-keygen');
			} finally {
				try {
					unlinkSync(keyPath);
					rmSync(tmpDir, { recursive: true, force: true });
				} catch (e) {
					// Ignore cleanup errors
				}
			}

			const vultr = new VultrService(provider.apiKey);
			await vultr.createSshKey(keyRecord.name, openSshPublicKey);

			return { success: true };
		} catch (err: any) {
			
			// Extract Vultr API error message if available
			const errorMessage = err.response?.data?.error || err.message || 'Failed to install SSH key';
			
			return fail(400, { error: errorMessage });
		}
	},

	removeKey: async ({ request, params, locals }) => {
		await requireAuth(locals);
		const isGodUser = await isGod(locals.user!.id);

		if (!locals.team && !isGodUser) {
			return fail(400, { error: 'Team required for this operation' });
		}

		const provider = await getVpsProviderById(params.id, locals.team?.id);
		if (!provider) throw error(404, 'Provider not found');

		const formData = await request.formData();
		const providerSshKeyId = formData.get('providerSshKeyId') as string;

		try {
			const vultr = new VultrService(provider.apiKey);
			await vultr.deleteSshKey(providerSshKeyId);

			return { success: true };
		} catch (err: any) {
			
			// Extract Vultr API error message if available
			const errorMessage = err.response?.data?.error || err.message || 'Failed to remove SSH key';
			
			return fail(400, { error: errorMessage });
		}
	}
};
