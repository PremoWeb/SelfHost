import axios from 'axios';

interface VultrInstance {
	id: string;
	os: string;
	ram: number;
	disk: number;
	main_ip: string;
	vcpu_count: number;
	region: string;
	plan: string;
	status: string;
	label: string;
}

export interface VultrDomain {
	domain: string;
	date_created: string;
}

export interface VultrPlan {
	id: string;
	ram: number;
	disk: number;
	monthly_cost: number;
	type: string;
	vcpu_count: number;
	bandwidth: number;
}

export class VultrService {
	private client;

	constructor(apiKey: string) {
		this.client = axios.create({
			baseURL: 'https://api.vultr.com/v2',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			}
		});
	}

	async accountInfo() {
		const response = await this.client.get('/account');
		return response.data.account;
	}

	async listInstances(): Promise<VultrInstance[]> {
		const response = await this.client.get('/instances');
		return response.data.instances;
	}

	async getInstance(instanceId: string): Promise<VultrInstance & { default_password?: string }> {
		const response = await this.client.get(`/instances/${instanceId}`);
		return response.data.instance;
	}

	async reinstallInstance(instanceId: string, hostname?: string): Promise<VultrInstance> {
		const response = await this.client.post(`/instances/${instanceId}/reinstall`, { hostname });
		return response.data.instance;
	}

	async updateInstance(instanceId: string, params: Record<string, any>): Promise<VultrInstance> {
		const response = await this.client.patch(`/instances/${instanceId}`, params);
		return response.data.instance;
	}

	async createInstance(params: {
		region: string;
		plan: string;
		os_id: number;
		label?: string;
		sshkey_ids?: string[];
		backups?: string;
		enable_ipv6?: boolean;
	}) {
		const response = await this.client.post('/instances', params);
		return response.data.instance;
	}

	async listSshKeys() {
		const response = await this.client.get('/ssh-keys');
		return response.data.ssh_keys;
	}

	async createSshKey(name: string, ssh_key: string) {
		const response = await this.client.post('/ssh-keys', {
			name,
			ssh_key
		});
		return response.data.ssh_key;
	}
	async deleteSshKey(sshKeyId: string) {
		await this.client.delete(`/ssh-keys/${sshKeyId}`);
	}

	async listPlans(type?: string): Promise<VultrPlan[]> {
		const response = await this.client.get('/plans', { params: { type } });
		return response.data.plans;
	}

	async listRegions() {
		const response = await this.client.get('/regions');
		return response.data.regions;
	}

    async listOs() {
		const response = await this.client.get('/os');
		return response.data.os;
	}

	async listAvailablePlansForRegion(regionId: string): Promise<string[]> {
		const response = await this.client.get(`/regions/${regionId}/availability`);
		return response.data.available_plans || [];
	}

	async listDomains(): Promise<VultrDomain[]> {
		const response = await this.client.get('/domains');
		return response.data.domains;
	}

	async createDomain(domain: string, ip?: string) {
		const response = await this.client.post('/domains', {
			domain,
			ip
		});
		return response.data.domain;
	}

	async deleteDomain(domainName: string) {
		await this.client.delete(`/domains/${domainName}`);
	}

	async listRecords(domainName: string) {
		const response = await this.client.get(`/domains/${domainName}/records`);
		return response.data.records;
	}

	async createRecord(domainName: string, params: {
		type: string;
		name: string;
		data: string;
		ttl?: number;
		priority?: number;
	}) {
		const response = await this.client.post(`/domains/${domainName}/records`, params);
		return response.data.record;
	}

	async deleteRecord(domainName: string, recordId: string) {
		await this.client.delete(`/domains/${domainName}/records/${recordId}`);
	}

	async updateRecord(domainName: string, recordId: string, params: {
		type?: string;
		name?: string;
		data?: string;
		ttl?: number;
		priority?: number;
	}) {
		const response = await this.client.patch(`/domains/${domainName}/records/${recordId}`, params);
		return response.data.record;
	}
}

/**
 * Get Vultr instances for a given API key
 */
export async function getVultrInstances(apiKey: string): Promise<VultrInstance[]> {
	const service = new VultrService(apiKey);
	return await service.listInstances();
}
