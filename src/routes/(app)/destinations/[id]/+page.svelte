<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { toastStore } from '$lib/stores/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import StickyHeader from '$lib/components/StickyHeader.svelte';
	import { ChevronLeft, Save, Trash2, Server, LayoutGrid, Box, Container } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let destination = $derived(data.destination);
	let servers = $derived(data.servers);
	let currentServerName = $derived(servers.find((s) => s.id === serverId)?.name || 'Unknown');

	let isUpdating = $state(false);
	let showDeleteDialog = $state(false);

	let type = $state(untrack(() => data.destination.type));
	let serverId = $state(untrack(() => data.destination.serverId));

	$effect(() => {
		type = data.destination.type;
		serverId = data.destination.serverId;
	});

	// Recommended logic similar to create modal
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

	const Icon = $derived(getTypeIcon(type));
</script>

<PageTitle title="Edit {destination.name}" />

<div class="mx-auto max-w-4xl space-y-6">
	<StickyHeader>
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<Button href="/destinations" variant="ghost" size="icon">
					<ChevronLeft class="size-5" />
				</Button>
				<div>
					<h1 class="text-3xl font-bold tracking-tight">{destination.name}</h1>
					<p class="text-muted-foreground mt-1">Configure your deployment destination settings.</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					class="text-destructive hover:bg-destructive/10"
					onclick={() => (showDeleteDialog = true)}
				>
					<Trash2 class="mr-2 size-4" />
					Delete
				</Button>
			</div>
		</div>
	</StickyHeader>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
		<Card.Root class="md:col-span-2">
			<Card.Header>
				<Card.Title>Settings</Card.Title>
				<Card.Description>General settings for this destination.</Card.Description>
			</Card.Header>
			<Card.Content>
				<form
					method="POST"
					action="?/update"
					use:enhance={() => {
						isUpdating = true;
						return async ({ result }) => {
							isUpdating = false;
							if (result.type === 'success') {
								toastStore.success('Destination updated');
							} else {
								toastStore.error('Update failed');
							}
						};
					}}
					class="space-y-6"
				>
					<div class="grid gap-4">
						<div class="grid gap-2">
							<Label for="name">Destination Label</Label>
							<Input id="name" name="name" value={destination.name} required />
						</div>

						<div class="grid gap-2">
							<Label for="description">Description</Label>
							<Input id="description" name="description" value={destination.description} />
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div class="grid gap-2">
								<Label for="type">Runtime Type</Label>
								<select
									id="type"
									name="type"
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
								<Input id="network" name="network" value={destination.network} />
							</div>
						</div>

						<div class="grid gap-2">
							<Label for="serverId">Target Server</Label>
							<select
								id="serverId"
								name="serverId"
								bind:value={serverId}
								required
								class="border-input bg-background ring-offset-background flex h-11 w-full rounded-md border px-3 py-2 text-sm"
							>
								{#if recommendedServers.length > 0}
									<optgroup label="Recommended for {type === 'swarm' ? 'Swarm' : 'Docker'}">
										{#each recommendedServers as server (server.id)}
											<option value={server.id}>
												{server.name} ({server.ip})
											</option>
										{/each}
									</optgroup>
								{/if}

								{#if otherServers.length > 0}
									<optgroup label="Other Available Servers">
										{#each otherServers as server (server.id)}
											<option value={server.id}>
												{server.name} ({server.ip})
											</option>
										{/each}
									</optgroup>
								{/if}
							</select>
						</div>
					</div>

					<div class="flex justify-end border-t pt-6">
						<Button type="submit" disabled={isUpdating}>
							<Save class="mr-2 size-4" />
							{isUpdating ? 'Saving...' : 'Save Changes'}
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>

		<div class="space-y-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Status</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="flex flex-col items-center justify-center gap-4 py-6">
						<div class="bg-muted rounded-full p-4">
							<Icon class="size-10" />
						</div>
						<div class="space-y-1 text-center">
							<p class="font-semibold capitalize">{type}</p>
							<p class="text-muted-foreground text-xs tracking-widest uppercase">Type</p>
						</div>
					</div>
					<div class="space-y-4 border-t pt-4 text-sm">
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground flex items-center gap-2">
								<Server class="size-4" />
								Node
							</span>
							<span class="font-medium">{currentServerName}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground">Network</span>
							<Badge variant="secondary">{destination.network}</Badge>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>

<AlertDialog.Root bind:open={showDeleteDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
			<AlertDialog.Description>
				This will permanently delete the destination **{destination.name}**. Applications deployed
				here may become unmanaged.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<form method="POST" action="?/delete" use:enhance>
				<Button type="submit" variant="destructive">Delete Destination</Button>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
