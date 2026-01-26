<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { serversApi } from '$lib/api/resources/servers';
	import { toastStore } from '$lib/stores/toast';
	import { formatDate } from '$lib/utils/helpers';
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import * as Dialog from '$lib/components/ui/dialog';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import StickyHeader from '$lib/components/StickyHeader.svelte';
	import { Plus, Server, Search, ArrowUpDown } from '@lucide/svelte';

	import RegisterServerForm from '$lib/components/servers/RegisterServerForm.svelte';
	import ServerRegistrationWizard from '$lib/components/servers/ServerRegistrationWizard.svelte';
	import { page } from '$app/state';
	import * as Sheet from '$lib/components/ui/sheet';

	let { data }: { data: PageData } = $props();

	let showAddModal = $state(false);
	let searchQuery = $state('');
	let sortField = $state<'name' | 'status' | 'region'>('name');
	let sortOrder = $state<'asc' | 'desc'>('asc');
	let isImporting = $state<string | null>(null);

	// Shallow route state for Wizard
	let isWizardOpen = $derived(page.url.searchParams.get('register') === 'true');

	function openWizard() {
		const url = new URL(page.url);
		url.searchParams.set('register', 'true');
		goto(url.toString(), { replaceState: false, noScroll: true });
	}

	function closeWizard() {
		const url = new URL(page.url);
		url.searchParams.delete('register');
		goto(url.toString(), { replaceState: false, noScroll: true });
	}

	// Filtered and sorted servers
	let filteredServers = $derived(
		data.servers
			.filter(
				(s) =>
					s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					s.ip.toLowerCase().includes(searchQuery.toLowerCase()) ||
					s.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					(s.tags &&
						s.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase())))
			)
			.sort((a, b) => {
				let aVal, bVal;

				if (sortField === 'name') {
					aVal = a.name.toLowerCase();
					bVal = b.name.toLowerCase();
				} else if (sortField === 'status') {
					// Sort by connection type and status
					const getStatusPriority = (server: typeof a) => {
						if (server.connectionType === 'agent' && server.status === 'online') return 0;
						if (server.connectionType === 'agent') return 1;
						if (server.status === 'online') return 2;
						return 3;
					};
					aVal = getStatusPriority(a);
					bVal = getStatusPriority(b);
				} else if (sortField === 'region') {
					aVal = a.region || '';
					bVal = b.region || '';
				}

				if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
				if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
				return 0;
			})
	);

	function toggleSort(field: typeof sortField) {
		if (sortField === field) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortOrder = 'asc';
		}
	}
</script>

<PageTitle title="Servers" />

<div class="space-y-6">
	<StickyHeader class="space-y-4">
		<div class="flex items-center justify-between">
			<div class="flex flex-col gap-1">
				<h1 class="text-3xl font-bold tracking-tight">Servers</h1>
				<p class="text-muted-foreground">Manage your infrastructure nodes and cloud instances.</p>
			</div>
			<Button onclick={openWizard}>
				<Plus class="mr-2 size-4" />
				Register Server
			</Button>
		</div>

		<div class="relative">
			<Search class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
			<Input
				bind:value={searchQuery}
				placeholder="Search servers by name, IP, or description..."
				class="h-11 pl-10"
				autofocus
			/>
		</div>
	</StickyHeader>

	<Card.Root>
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead class="w-[30%]">
						<button
							onclick={() => toggleSort('name')}
							class="hover:text-foreground flex items-center gap-2"
						>
							Server
							<ArrowUpDown class="size-3" />
						</button>
					</TableHead>
					<TableHead>
						<button
							onclick={() => toggleSort('status')}
							class="hover:text-foreground flex items-center gap-2"
						>
							Status
							<ArrowUpDown class="size-3" />
						</button>
					</TableHead>
					<TableHead>Type</TableHead>
					<TableHead>Connection</TableHead>
					<TableHead>
						<button
							onclick={() => toggleSort('region')}
							class="hover:text-foreground flex items-center gap-2"
						>
							Region
							<ArrowUpDown class="size-3" />
						</button>
					</TableHead>
					<TableHead>Assigned</TableHead>
					<TableHead>Health</TableHead>
					<TableHead class="text-right">Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#each filteredServers as server}
					<TableRow>
						<TableCell class="font-medium">
							<div class="space-y-1">
								<div class="flex items-center gap-2">
									<Server class="text-muted-foreground size-4" />
									<span>{server.name}</span>
								</div>
								<div class="text-muted-foreground font-mono text-xs">
									{server.user}@{server.ip}:{server.port}
								</div>
								{#if server.description}
									<div class="text-muted-foreground line-clamp-1 text-xs">
										{server.description}
									</div>
								{/if}
							</div>
						</TableCell>
						<TableCell>
							{#if server.connectionType === 'agent'}
								<div class="flex flex-col items-start gap-1">
									<Badge
										variant="outline"
										class={server.status === 'online'
											? 'border-green-200 bg-green-50 text-green-600'
											: 'border-orange-200 bg-orange-50 text-orange-600'}
									>
										Agent {server.status === 'online' ? 'Connected' : 'Offline'}
									</Badge>
									{#if data.localAgentChecksum && server.agentChecksum && data.localAgentChecksum !== server.agentChecksum}
										<Badge
											variant="secondary"
											class="animate-pulse border-yellow-200 bg-yellow-100 px-1.5 py-0 text-[9px] font-bold text-yellow-700 uppercase"
										>
											Out of Sync
										</Badge>
									{/if}
								</div>
							{:else if server.connectionType === 'ssh'}
								<Badge variant="outline" class="border-blue-200 bg-blue-50 text-blue-600"
									>SSH Only</Badge
								>
							{:else}
								<Badge variant="outline" class="border-gray-200 text-gray-600">Offline</Badge>
							{/if}
						</TableCell>
						<TableCell>
							{#if true}
								{@const isProxmox = server.tags && server.tags.includes('proxmox')}
								{@const serverType = isProxmox ? 'Proxmox' : (server.providerName || 'Custom')}
								<div class="flex flex-col gap-1">
									<Badge
										variant="secondary"
										class="w-fit border-blue-200 bg-blue-100/50 px-1.5 py-0 text-[10px] text-blue-700 uppercase"
									>
										{serverType}
									</Badge>
									{#if server.cloudflareTunnelHostname}
										<Badge
											variant="secondary"
											class="w-fit border-purple-200 bg-purple-100/50 px-1.5 py-0 text-[10px] text-purple-700 uppercase"
										>
											Tunnel
										</Badge>
									{/if}
								</div>
							{/if}
						</TableCell>
						<TableCell>
							<span class="text-muted-foreground text-sm capitalize">
								{server.connectionType || 'ssh'}
							</span>
						</TableCell>
						<TableCell>
							{#if server.region}
								<span class="text-muted-foreground text-sm">{server.region}</span>
							{:else}
								<span class="text-muted-foreground text-sm italic opacity-50">—</span>
							{/if}
						</TableCell>
						<TableCell>
							<div class="flex flex-col gap-1.5">
								<div class="flex items-center gap-1.5">
									<Badge
										variant="secondary"
										class="border-blue-200 bg-blue-100/50 px-1.5 py-0 text-[10px] text-blue-700 uppercase"
									>
										{server.application_count || 0} Apps
									</Badge>
									<Badge
										variant="secondary"
										class="border-purple-200 bg-purple-100/50 px-1.5 py-0 text-[10px] text-purple-700 uppercase"
									>
										{server.database_count || 0} DBs
									</Badge>
								</div>
								<div class="flex max-w-[200px] flex-wrap gap-1">
									{#each server.tags || [] as tag}
										<Badge variant="secondary" class="px-1 py-0 text-[9px] uppercase opacity-70">
											{tag}
										</Badge>
									{/each}
								</div>
							</div>
						</TableCell>
						<TableCell>
							{#if server.connectionType === 'agent' && server.status === 'online'}
								<div class="flex items-center gap-3 text-xs">
									<div class="flex items-center gap-1">
										<span class="text-muted-foreground">CPU:</span>
										<span class="font-medium"
											>{Math.round((server.healthCpu || 0) * 100) / 100}%</span
										>
									</div>
									<div class="flex items-center gap-1">
										<span class="text-muted-foreground">RAM:</span>
										<span class="font-medium">{server.healthMemory || 0}%</span>
									</div>
									<div class="flex items-center gap-1">
										<span class="text-muted-foreground">Disk:</span>
										<span class="font-medium">{server.healthDisk || 0}%</span>
									</div>
								</div>
							{:else}
								<span class="text-muted-foreground text-xs italic opacity-50">No data</span>
							{/if}
						</TableCell>
						<TableCell class="text-right">
							<Button href="/servers/{server.id}" variant="outline" size="sm">Manage</Button>
						</TableCell>
					</TableRow>
				{:else}
					<TableRow>
						<TableCell colspan={9} class="h-24 text-center text-muted-foreground">
							{searchQuery
								? 'No servers match your search.'
								: 'No servers found. Add a server to start deploying.'}
						</TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	</Card.Root>

	<!-- Cloud Provider Discovery Section -->
	{#if data.discoveredInstances && data.discoveredInstances.length > 0}
		<div class="space-y-4 pt-4">
			<h2 class="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
				Discovered Cloud Instances
			</h2>
			<p class="text-muted-foreground text-sm">
				VPS instances found in your connected cloud providers. Import them to manage with PremoHost.
			</p>
			<Card.Root>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Instance</TableHead>
							<TableHead>Provider</TableHead>
							<TableHead>Specs</TableHead>
							<TableHead>Status</TableHead>
							<TableHead class="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each data.discoveredInstances as instance}
							<TableRow>
								<TableCell class="font-medium">
									<div class="space-y-1">
										<div class="flex items-center gap-2">
											<Server class="size-4 text-blue-400" />
											<span>{instance.label || instance.id}</span>
										</div>
										<div class="text-muted-foreground font-mono text-xs">
											{instance.main_ip}
										</div>
									</div>
								</TableCell>
								<TableCell>
									<span class="text-muted-foreground text-sm">{instance.providerName}</span>
								</TableCell>
								<TableCell>
									<div class="text-muted-foreground flex gap-2 text-xs">
										<span>{instance.vcpu_count} vCPU</span>
										<span>•</span>
										<span>{Math.round(instance.ram / 1024)} GB RAM</span>
										<span>•</span>
										<span>{instance.disk} GB</span>
									</div>
								</TableCell>
								<TableCell>
									<Badge
										variant="outline"
										class="border-blue-200 bg-blue-50 text-blue-600 capitalize"
										>{instance.status}</Badge
									>
								</TableCell>
								<TableCell class="text-right">
									<form
										method="POST"
										action="?/importInstance"
										use:enhance={() => {
											isImporting = instance.id;
											return async ({ result }) => {
												isImporting = null;
												if (result.type === 'success') {
													toastStore.success(`${instance.label || instance.id} imported`);
													await invalidateAll();
												} else if (result.type === 'failure') {
													toastStore.error(
														(result.data?.message as string) || 'Failed to import instance'
													);
												} else if (result.type === 'error') {
													toastStore.error('An unexpected error occurred');
												}
											};
										}}
									>
										<input type="hidden" name="instanceId" value={instance.id} />
										<input type="hidden" name="name" value={instance.label || instance.id} />
										<input type="hidden" name="ip" value={instance.main_ip} />
										<input type="hidden" name="providerId" value={instance.providerId} />
										<input type="hidden" name="region" value={instance.region || ''} />
										<Button
											type="submit"
											variant="outline"
											size="sm"
											disabled={isImporting === instance.id}
										>
											{isImporting === instance.id ? 'Importing...' : 'Import'}
										</Button>
									</form>
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</Card.Root>
		</div>
	{/if}
</div>

<Sheet.Root
	open={isWizardOpen}
	onOpenChange={(open) => {
		if (!open) closeWizard();
	}}
>
	<Sheet.Content side="right" class="w-full p-0 sm:max-w-xl">
		<ServerRegistrationWizard
			privateKeys={data.privateKeys}
			accessTokens={data.accessTokens}
			onClose={closeWizard}
		/>
	</Sheet.Content>
</Sheet.Root>
