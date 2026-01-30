<script lang="ts">
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import StickyHeader from '$lib/components/StickyHeader.svelte';
	import {
		Plus,
		Trash2,
		Lock,
		Globe,
		Key,
		Shield,
		Eye,
		EyeOff,
		Terminal,
		Search,
		Settings2
	} from 'lucide-svelte';
	import type { PageData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import { fade, slide } from 'svelte/transition';

	let { data }: { data: PageData } = $props();

	let newKey = $state('');
	let newValue = $state('');
	let newIsPublic = $state(false);
	let isCreating = $state(false);
	let showSecrets = $state<{ [key: string]: boolean }>({});
	let searchQuery = $state('');

	const filteredVariables = $derived(
		data.variables.filter((v) => v.key.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	function toggleSecret(id: string) {
		showSecrets[id] = !showSecrets[id];
	}

	async function handleAdd() {
		if (!newKey) {
			toastStore.error('Variable key is required');
			return;
		}

		isCreating = true;
		try {
			await api.post('/variables', {
				key: newKey.toUpperCase().replace(/\s+/g, '_'),
				value: newValue,
				isPublic: newIsPublic
			});
			await invalidateAll();
			newKey = '';
			newValue = '';
			newIsPublic = false;
			toastStore.success('Variable created successfully');
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to create variable');
		} finally {
			isCreating = false;
		}
	}

	async function handleDelete(id: string) {
		try {
			// This would call your API once implemented
			// await api.delete(`/variables/${id}`);
			// await invalidateAll();
			toastStore.info('Variable deletion is currently being implemented');
		} catch (error: any) {
			toastStore.error('Failed to remove variable');
		}
	}
</script>

<StickyHeader>
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="space-y-1">
			<div class="flex items-center gap-2">
				<Shield class="text-primary size-6" />
				<h1 class="text-3xl font-extrabold tracking-tight">Shared Variables</h1>
			</div>
			<p class="text-muted-foreground text-sm">
				Global environment variables shared across all applications in your team.
			</p>
		</div>
		<div class="flex items-center gap-3">
			<div class="relative max-w-sm">
				<Search class="text-muted-foreground/50 absolute top-1/2 left-3 size-4 -translate-y-1/2" />
				<Input
					placeholder="Search variables..."
					bind:value={searchQuery}
					class="w-full pl-9 sm:w-[250px]"
				/>
			</div>
		</div>
	</div>
</StickyHeader>

<div class="mt-8 space-y-10 pb-20">
	<!-- Creation Card -->
	<Card.Root class="border-border/50 bg-card/30 overflow-hidden backdrop-blur-sm">
		<Card.Header class="bg-muted/30 border-border/40 border-b py-4">
			<Card.Title class="flex items-center gap-2 text-lg">
				<Plus class="text-primary size-4" />
				Create New Variable
			</Card.Title>
			<Card.Description>Add a shared secret or public configuration value.</Card.Description>
		</Card.Header>
		<Card.Content class="p-6">
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleAdd();
				}}
				class="grid grid-cols-1 items-end gap-6 lg:grid-cols-12"
			>
				<div class="space-y-2 lg:col-span-3">
					<Label
						for="newKey"
						class="text-muted-foreground text-xs font-bold tracking-wider uppercase"
						>Variable Key</Label
					>
					<div class="relative">
						<Terminal
							class="text-muted-foreground/40 absolute top-1/2 left-3 size-4 -translate-y-1/2"
						/>
						<Input
							id="newKey"
							bind:value={newKey}
							placeholder="DB_PASSWORD"
							class="pl-9 font-mono uppercase"
							required
						/>
					</div>
				</div>
				<div class="space-y-2 lg:col-span-5">
					<Label
						for="newValue"
						class="text-muted-foreground text-xs font-bold tracking-wider uppercase">Value</Label
					>
					<div class="relative">
						<Key class="text-muted-foreground/40 absolute top-1/2 left-3 size-4 -translate-y-1/2" />
						<Input
							id="newValue"
							type={newIsPublic ? 'text' : 'password'}
							bind:value={newValue}
							placeholder="••••••••••••"
							class="pl-9"
						/>
					</div>
				</div>
				<div class="flex items-center gap-6 lg:col-span-4 lg:justify-end">
					<div
						class="border-border/40 bg-muted/20 flex items-center space-x-2 rounded-md border px-3 py-2"
					>
						<Checkbox id="isPublic" bind:checked={newIsPublic} />
						<Label
							for="isPublic"
							class="flex cursor-pointer items-center gap-2 text-sm leading-none font-medium"
						>
							{#if newIsPublic}
								<Globe class="size-3.5 text-blue-500" />
								<span>Public Value</span>
							{:else}
								<Lock class="size-3.5 text-amber-500" />
								<span>Encrypted Secret</span>
							{/if}
						</Label>
					</div>
					<Button type="submit" loading={isCreating} class="group">
						<Plus class="mr-2 size-4 transition-transform group-hover:rotate-90" />
						Add Variable
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<!-- Variables List -->
	<div
		class="border-border/50 bg-card/30 overflow-hidden rounded-xl border shadow-sm backdrop-blur-sm"
	>
		<Table.Root>
			<Table.Header class="bg-muted/40">
				<Table.Row class="hover:bg-transparent">
					<Table.Head
						class="text-muted-foreground w-[300px] text-xs font-bold tracking-widest uppercase"
						>Key</Table.Head
					>
					<Table.Head class="text-muted-foreground text-xs font-bold tracking-widest uppercase"
						>Value</Table.Head
					>
					<Table.Head
						class="text-muted-foreground w-[150px] text-center text-xs font-bold tracking-widest uppercase"
						>Security</Table.Head
					>
					<Table.Head
						class="text-muted-foreground w-[100px] px-6 text-right text-xs font-bold tracking-widest uppercase"
						>Actions</Table.Head
					>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each filteredVariables as v (v.id)}
					<Table.Row class="group border-border/40 hover:bg-muted/20 transition-colors">
						<Table.Cell class="text-foreground py-5 font-mono text-sm font-bold">
							<div class="flex items-center gap-3">
								<div
									class="size-2 rounded-full {v.isPublic ? 'bg-blue-500' : 'bg-amber-500'}"
								></div>
								{v.key}
							</div>
						</Table.Cell>
						<Table.Cell class="py-5">
							<div class="flex items-center gap-3">
								<span class="text-muted-foreground/80 font-mono text-sm">
									{#if v.isPublic || showSecrets[v.id]}
										<span in:fade={{ duration: 150 }}>{v.value}</span>
									{:else}
										<span class="tracking-[0.3em]">••••••••••••</span>
									{/if}
								</span>
								{#if !v.isPublic}
									<button
										onclick={() => toggleSecret(v.id)}
										class="hover:bg-muted rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100"
										title={showSecrets[v.id] ? 'Hide secret' : 'Show secret'}
									>
										{#if showSecrets[v.id]}
											<EyeOff class="text-muted-foreground size-3.5" />
										{:else}
											<Eye class="text-muted-foreground size-3.5" />
										{/if}
									</button>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell class="py-5 text-center">
							{#if v.isPublic}
								<Badge
									variant="outline"
									class="border-blue-500/30 bg-blue-500/5 text-[10px] font-bold tracking-widest text-blue-500 uppercase"
								>
									<Globe class="mr-1 size-3" />
									Public
								</Badge>
							{:else}
								<Badge
									variant="outline"
									class="border-amber-500/30 bg-amber-500/5 text-[10px] font-bold tracking-widest text-amber-500 uppercase"
								>
									<Lock class="mr-1 size-3" />
									Secret
								</Badge>
							{/if}
						</Table.Cell>
						<Table.Cell class="px-6 py-5 text-right">
							<div class="flex items-center justify-end gap-2">
								<Button
									variant="ghost"
									size="icon"
									class="text-muted-foreground hover:text-destructive hover:bg-destructive/10 size-8 opacity-0 transition-all group-hover:opacity-100"
									onclick={() => handleDelete(v.id)}
								>
									<Trash2 class="size-4" />
								</Button>
							</div>
						</Table.Cell>
					</Table.Row>
				{/each}

				{#if filteredVariables.length === 0}
					<Table.Row>
						<Table.Cell colspan={4} class="py-20 text-center">
							<div class="flex flex-col items-center justify-center space-y-3 opacity-40">
								<Settings2 class="size-12" />
								<div class="space-y-1">
									<p class="text-foreground text-lg font-bold tracking-tight">
										{searchQuery ? 'No variables match your search' : 'No shared variables found'}
									</p>
									<p class="text-sm">Shared variables appear here once created.</p>
								</div>
							</div>
						</Table.Cell>
					</Table.Row>
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
</div>
