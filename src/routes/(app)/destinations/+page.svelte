<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import { formatDate } from '$lib/utils/helpers';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';

	import PageTitle from '$lib/components/PageTitle.svelte';
	import StickyHeader from '$lib/components/StickyHeader.svelte';
	import { Plus, Server, Network, LayoutGrid, Box, Container } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let servers = $derived(data.servers);
	let destinations = $derived(data.destinations);

	let showCreateModal = $state(false);
	let name = $state('');
	let description = $state('');
	let serverId = $state('');
	let type = $state('docker');
	let network = $state('selfhost');
	let isCreating = $state(false);

	// Derived lists for selection
	let recommendedServers = $derived(
		servers.filter((s) => {
			const tags = s.tags || [];
			if (type === 'swarm') return tags.includes('swarm') || tags.includes('manager');
			if (type === 'docker') return !tags.includes('swarm') || tags.includes('production');
			return false;
		})
	);

	let otherServers = $derived(
		servers.filter((s) => !recommendedServers.find((rs) => rs.id === s.id))
	);

	// Auto-detect type and suggest name when server is selected
	$effect(() => {
		if (serverId) {
			const selectedServer = servers.find((s) => s.id === serverId);
			if (selectedServer) {
				const tags = selectedServer.tags || [];

				// Auto-detect type
				if (tags.includes('swarm')) {
					type = 'swarm';
				} else if (tags.includes('k8s') || tags.includes('kubernetes')) {
					type = 'kubernetes';
				} else {
					type = 'docker';
				}

				// Smart Naming Suggestion (only if name is empty or looks like a placeholder)
				if (!name || name.startsWith('New ') || name.includes(' Destination')) {
					const regionPrefix = selectedServer.region
						? `${selectedServer.region.split('-')[0].toUpperCase()} `
						: '';
					const typeSuffix = type === 'swarm' ? 'Swarm Cluster' : 'Standalone Host';
					const tagLabel =
						tags.find((t: string) => ['production', 'staging', 'dev'].includes(t)) || '';
					const capitalizedTag = tagLabel
						? tagLabel.charAt(0).toUpperCase() + tagLabel.slice(1) + ' '
						: '';

					name = `${regionPrefix}${capitalizedTag}${typeSuffix}`;
				}
			}
		}
	});

	async function handleCreate() {
		if (!name || !serverId) {
			toastStore.error('Name and Server are required');
			return;
		}

		isCreating = true;
		try {
			await api.post('/destinations', { name, description, serverId, type, network });
			toastStore.success('Destination created successfully');
			showCreateModal = false;
			name = '';
			description = '';
			serverId = '';
			// Refresh page data
			goto('/destinations', { invalidateAll: true });
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to create destination');
		} finally {
			isCreating = false;
		}
	}

	function getTypeIcon(type: string) {
		switch (type) {
			case 'swarm':
				return LayoutGrid;
			case 'kubernetes':
				return Box;
			default:
				return Container;
		}
	}
</script>

<PageTitle title="Destinations" />

<div class="space-y-6">
	<StickyHeader>
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">Destinations</h1>
				<p class="text-muted-foreground mt-1">Manage your Docker hosts and Swarm clusters.</p>
			</div>
			<Button onclick={() => (showCreateModal = true)}>
				<Plus class="mr-2 size-4" />
				Add Destination
			</Button>
		</div>
	</StickyHeader>

	{#if data.destinations.length === 0}
		<Card.Root class="border-dashed">
			<Card.Content class="flex flex-col items-center justify-center py-12 text-center">
				<div class="bg-muted/50 mb-4 rounded-full p-4">
					<Container class="text-muted-foreground size-8" />
				</div>
				<h3 class="text-lg font-semibold">No destinations</h3>
				<p class="text-muted-foreground mt-1 mb-6 max-w-sm text-sm">
					Get started by adding a new Docker destination.
				</p>
				<Button onclick={() => (showCreateModal = true)}>Add Destination</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each destinations as dest (dest.id)}
				{@const Icon = getTypeIcon(dest.type)}
				<a href="/destinations/{dest.id}" class="group block">
					<Card.Root
						class="group-hover:border-primary/50 h-full transition-all group-hover:shadow-md"
					>
						<Card.Header>
							<div class="flex items-start justify-between gap-2">
								<div class="flex items-center gap-3">
									<div class="bg-muted rounded-lg p-2">
										<Icon class="size-5" />
									</div>
									<div class="space-y-1">
										<Card.Title class="text-base font-semibold">{dest.name}</Card.Title>
										<Badge variant="outline" class="capitalize">{dest.type}</Badge>
									</div>
								</div>
							</div>
						</Card.Header>
						<Card.Content>
							{#if dest.description}
								<p class="text-muted-foreground mb-4 line-clamp-2 text-sm">
									{dest.description}
								</p>
							{/if}
							<div class="space-y-2 text-sm">
								<div class="text-muted-foreground flex items-center">
									<Server class="mr-2 size-4" />
									<span class="truncate"
										>Server: <span class="text-foreground">{dest.serverName}</span></span
									>
								</div>
								<div class="text-muted-foreground flex items-center">
									<Network class="mr-2 size-4" />
									<span class="truncate"
										>Network: <span class="text-foreground">{dest.network}</span></span
									>
								</div>
							</div>
						</Card.Content>
						<Card.Footer>
							<div class="text-muted-foreground w-full text-xs">
								Created {formatDate(dest.createdAt.toString())}
							</div>
						</Card.Footer>
					</Card.Root>
				</a>
			{/each}
		</div>
	{/if}
</div>

<Dialog.Root bind:open={showCreateModal}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Add New Destination</Dialog.Title>
			<Dialog.Description>
				Select a server to deploy your applications. We'll automatically detect the environment.
			</Dialog.Description>
		</Dialog.Header>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleCreate();
			}}
			class="space-y-4 pt-4"
		>
			<div class="grid gap-2">
				<Label for="serverId">Target Server</Label>
				<select
					id="serverId"
					bind:value={serverId}
					required
					class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-11 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
				>
					<option value="" disabled>Select a server...</option>

					{#if recommendedServers.length > 0}
						<optgroup label="Recommended for {type === 'swarm' ? 'Swarm' : 'Docker'}">
							{#each recommendedServers as server (server.id)}
								<option value={server.id}>
									{server.name} ({server.ip}) — {server.tags?.join(', ') || 'No tags'}
								</option>
							{/each}
						</optgroup>
					{/if}

					{#if otherServers.length > 0}
						<optgroup label="Other Available Servers">
							{#each otherServers as server (server.id)}
								<option value={server.id}>
									{server.name} ({server.ip}) — {server.tags?.join(', ') || 'No tags'}
								</option>
							{/each}
						</optgroup>
					{/if}
				</select>
				<p class="text-muted-foreground px-1 text-[11px]">
					Tip: Servers tagged with <strong>swarm</strong> or <strong>manager</strong> are recommended
					for Swarm destinations.
				</p>
			</div>

			<div class="grid gap-2">
				<Label for="name">Destination Label</Label>
				<div class="relative">
					<Input
						id="name"
						bind:value={name}
						placeholder="e.g. Production Swarm"
						required
						class="pr-20"
					/>
					{#if serverId}
						<Badge variant="secondary" class="absolute top-1.5 right-2 text-[9px] uppercase"
							>Auto-Suggested</Badge
						>
					{/if}
				</div>
			</div>

			<div class="grid gap-2">
				<Label for="description">Description (Optional)</Label>
				<Input
					id="description"
					bind:value={description}
					placeholder="e.g. Main swarm cluster in US East"
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="grid gap-2">
					<Label for="type">Runtime Type</Label>
					<select
						id="type"
						bind:value={type}
						class="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
					>
						<option value="docker">Standalone Docker</option>
						<option value="swarm">Docker Swarm</option>
						<option value="kubernetes">Kubernetes</option>
					</select>
				</div>
				<div class="grid gap-2">
					<Label for="network">Docker Network</Label>
					<Input id="network" bind:value={network} placeholder="selfhost" />
				</div>
			</div>

			<Dialog.Footer class="gap-2 pt-4 sm:gap-0">
				<Button
					type="button"
					variant="ghost"
					onclick={() => {
						showCreateModal = false;
						serverId = '';
						name = '';
					}}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={isCreating} class="min-w-32">
					{#if isCreating}
						<div class="flex items-center gap-2">
							<div
								class="border-primary-foreground size-3 animate-spin rounded-full border-2 border-t-transparent"
							></div>
							<span>Connecting...</span>
						</div>
					{:else}
						Add Destination
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
