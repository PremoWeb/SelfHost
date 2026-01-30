<script lang="ts">
	import { page } from '$app/stores';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import { formatDate } from '$lib/utils/helpers';
	import Button from '$lib/components/forms/Button.svelte';
	import Input from '$lib/components/forms/Input.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/ui/table';
	import {
		Box,
		Database,
		Plus,
		Github,
		GitBranch,
		ArrowRight,
		ExternalLink,
		Activity,
		Search,
		ArrowUpDown
	} from '@lucide/svelte';
	import type { PageData } from './$types';
	import PageTitle from '$lib/components/PageTitle.svelte';

	let { data }: { data: PageData } = $props();

	let showCreateModal = $state(false);

	// Create Form Data
	let name = $state('');
	let description = $state('');
	let selectedSourceId = $state('');
	let selectedDestinationId = $state('');
	let gitRepository = $state('');
	let gitBranch = $state('main');
	let buildPack = $state('nixpacks');

	let isCreating = $state(false);
	let searchQuery = $state('');
	let sortField = $state<'name' | 'status' | 'updatedAt'>('name');
	let sortOrder = $state<'asc' | 'desc'>('asc');

	let filteredApplications = $derived(
		data.applications
			.filter(
				(app) =>
					app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					app.gitRepository?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					app.description?.toLowerCase().includes(searchQuery.toLowerCase())
			)
			.sort((a, b) => {
				let aVal, bVal;
				if (sortField === 'name') {
					aVal = a.name.toLowerCase();
					bVal = b.name.toLowerCase();
				} else if (sortField === 'status') {
					aVal = a.status;
					bVal = b.status;
				} else {
					aVal = new Date(a.updatedAt).getTime();
					bVal = new Date(b.updatedAt).getTime();
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

	// Pre-select first available options
	$effect(() => {
		if (showCreateModal) {
			if (data.sources.length > 0 && !selectedSourceId) selectedSourceId = data.sources[0].id;
			if (data.destinations.length > 0 && !selectedDestinationId)
				selectedDestinationId = data.destinations[0].id;
		}
	});

	async function handleCreate() {
		if (!name || !selectedSourceId || !selectedDestinationId || !gitRepository) {
			toastStore.error('Please fill in all required fields');
			return;
		}

		isCreating = true;
		try {
			await api.post('/applications', {
				name,
				description,
				environmentId: data.environment.id,
				sourceId: selectedSourceId,
				destinationId: selectedDestinationId,
				gitRepository,
				gitBranch,
				buildPack
			});
			toastStore.success('Application created successfully');
			window.location.reload();
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to create application');
		} finally {
			isCreating = false;
		}
	}
</script>

<PageTitle title={data.environment.name} />

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<div class="mb-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
				<a href="/projects" class="hover:text-gray-700 dark:hover:text-gray-300">Projects</a>
				<span>/</span>
				<a
					href="/projects/{data.environment.projectId}"
					class="hover:text-gray-700 dark:hover:text-gray-300">Project</a
				>
				<span>/</span>
				<span>{data.environment.name}</span>
			</div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">{data.environment.name}</h1>
			{#if data.environment.description}
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					{data.environment.description}
				</p>
			{/if}
		</div>
		<Button onclick={() => (showCreateModal = true)}>+ New Resource</Button>
	</div>

	<!-- Resources Grid -->
	<div class="space-y-8">
		<!-- Applications -->
		<section class="space-y-4">
			<div class="flex items-center justify-between gap-4">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">Applications</h2>
				<div class="relative w-72">
					<Search class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
					<Input
						id="search"
						name="search"
						bind:value={searchQuery}
						placeholder="Search applications..."
						class="h-9 pl-10"
						autofocus
					/>
				</div>
			</div>

			{#if data.applications.length === 0}
				<div
					class="dark:bg-coolgray-100 dark:border-coolgray-300 rounded-lg border border-dashed border-gray-300 bg-white py-12 text-center"
				>
					<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No applications</h3>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Get started by creating a new application.
					</p>
					<div class="mt-6">
						<Button onclick={() => (showCreateModal = true)}>Add Application</Button>
					</div>
				</div>
			{:else}
				<Card.Root>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead class="w-[30%]">
									<button
										onclick={() => toggleSort('name')}
										class="hover:text-foreground flex items-center gap-2"
									>
										Application
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
								<TableHead>Repository</TableHead>
								<TableHead>
									<button
										onclick={() => toggleSort('updatedAt')}
										class="hover:text-foreground flex items-center gap-2"
									>
										Last Updated
										<ArrowUpDown class="size-3" />
									</button>
								</TableHead>
								<TableHead class="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each filteredApplications as app}
								<TableRow>
									<TableCell class="font-medium">
										<div class="space-y-1">
											<a
												href={`/projects/${data.environment.projectId}/${data.environment.id}/application/${app.id}`}
												class="flex items-center gap-2 font-semibold hover:underline"
											>
												<Box class="text-muted-foreground size-4" />
												{app.name}
											</a>
											{#if app.description}
												<div class="text-muted-foreground line-clamp-1 text-xs">
													{app.description}
												</div>
											{/if}
										</div>
									</TableCell>
									<TableCell>
										<Badge
											variant={app.status === 'running' ? 'outline' : 'secondary'}
											class="text-[10px] capitalize {app.status === 'running'
												? 'border-green-200 bg-green-50 text-green-600'
												: ''}"
										>
											<Activity class="mr-1 size-3" />
											{app.status}
										</Badge>
									</TableCell>
									<TableCell>
										<div class="flex flex-col font-mono text-xs">
											<div class="flex items-center gap-1.5">
												<Github class="text-muted-foreground size-3" />
												<span class="max-w-[200px] truncate">{app.gitRepository}</span>
											</div>
											<div class="text-muted-foreground mt-1 flex items-center gap-1.5">
												<GitBranch class="size-3" />
												<span>{app.gitBranch}</span>
											</div>
										</div>
									</TableCell>
									<TableCell>
										<span class="text-muted-foreground text-xs">
											{formatDate(app.updatedAt.toString())}
										</span>
									</TableCell>
									<TableCell class="text-right">
										<Button
											href={`/projects/${data.environment.projectId}/${data.environment.id}/application/${app.id}`}
											variant="outline"
											size="sm"
										>
											View Details
										</Button>
									</TableCell>
								</TableRow>
							{:else}
								<TableRow>
									<TableCell colspan={5} class="h-24 text-center text-muted-foreground">
										No applications match your search.
									</TableCell>
								</TableRow>
							{/each}
						</TableBody>
					</Table>
				</Card.Root>
			{/if}
		</section>

		<!-- Databases -->
		<section>
			<div class="mb-4 flex items-center gap-2">
				<Database class="text-muted-foreground size-5" />
				<h2 class="text-xl font-bold">Databases</h2>
			</div>
			<div class="bg-muted/20 rounded-lg border-2 border-dashed py-10 text-center">
				<Database class="text-muted-foreground mx-auto mb-2 size-8 opacity-20" />
				<p class="text-muted-foreground text-sm italic">Databases coming soon</p>
			</div>
		</section>
	</div>
</div>

<!-- Create Application Modal -->
<Dialog.Root bind:open={showCreateModal}>
	<Dialog.Content class="max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>New Application</Dialog.Title>
			<Dialog.Description>Deploy a new application from a Git repository.</Dialog.Description>
		</Dialog.Header>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleCreate();
			}}
			class="space-y-6 py-4"
			autocomplete="off"
		>
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="name">Application Name</Label>
					<Input id="name" name="name" bind:value={name} placeholder="my-awesome-app" required />
				</div>
				<div class="space-y-2">
					<Label for="description">Description</Label>
					<Input
						id="description"
						name="description"
						bind:value={description}
						placeholder="Short summary"
					/>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="source">Source</Label>
					<div class="relative">
						<select
							id="source"
							bind:value={selectedSourceId}
							class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
							required
						>
							<option value="" disabled>Select a Source</option>
							{#each data.sources as source}
								<option value={source.id}>{source.name} ({source.type})</option>
							{/each}
						</select>
						{#if data.sources.length === 0}
							<p class="text-destructive mt-1 text-[10px]">
								No sources found. <a href="/sources" class="hover:text-destructive/80 underline"
									>Add one first</a
								>.
							</p>
						{/if}
					</div>
				</div>

				<div class="space-y-2">
					<Label for="destination">Destination</Label>
					<div class="relative">
						<select
							id="destination"
							bind:value={selectedDestinationId}
							class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
							required
						>
							<option value="" disabled>Select a Destination</option>
							{#each data.destinations as dest}
								<option value={dest.id}>{dest.name} ({dest.type})</option>
							{/each}
						</select>
						{#if data.destinations.length === 0}
							<p class="text-destructive mt-1 text-[10px]">
								No destinations found. <a
									href="/destinations"
									class="hover:text-destructive/80 underline">Add one first</a
								>.
							</p>
						{/if}
					</div>
				</div>
			</div>

			<div class="bg-muted/30 space-y-4 rounded-md border p-4">
				<div class="mb-2 flex items-center gap-2">
					<Github class="size-4" />
					<h4 class="text-sm font-medium">Repository Details</h4>
				</div>
				<div class="grid grid-cols-3 gap-4">
					<div class="col-span-2 space-y-2">
						<Label for="gitRepository">Repository</Label>
						<Input
							id="gitRepository"
							name="gitRepository"
							bind:value={gitRepository}
							placeholder="owner/repo"
							required
						/>
					</div>
					<div class="space-y-2">
						<Label for="gitBranch">Branch</Label>
						<Input
							id="gitBranch"
							name="gitBranch"
							bind:value={gitBranch}
							placeholder="main"
							required
						/>
					</div>
				</div>
			</div>

			<div class="space-y-2">
				<Label for="buildPack">Build Pack</Label>
				<div class="grid grid-cols-3 gap-4">
					<button
						type="button"
						class="hover:bg-muted/50 flex flex-col items-center justify-center gap-2 rounded-md border p-4 text-center text-sm transition-all {buildPack ===
						'nixpacks'
							? 'border-primary bg-primary/5 ring-primary ring-1'
							: 'bg-background'}"
						onclick={() => (buildPack = 'nixpacks')}
					>
						<div class="font-medium">Nixpacks</div>
						<span class="text-muted-foreground text-[10px]">Auto-detect</span>
					</button>
					<button
						type="button"
						class="hover:bg-muted/50 flex flex-col items-center justify-center gap-2 rounded-md border p-4 text-center text-sm transition-all {buildPack ===
						'dockerfile'
							? 'border-primary bg-primary/5 ring-primary ring-1'
							: 'bg-background'}"
						onclick={() => (buildPack = 'dockerfile')}
					>
						<div class="font-medium">Dockerfile</div>
						<span class="text-muted-foreground text-[10px]">Custom build</span>
					</button>
					<button
						type="button"
						class="hover:bg-muted/50 flex flex-col items-center justify-center gap-2 rounded-md border p-4 text-center text-sm transition-all {buildPack ===
						'docker-compose'
							? 'border-primary bg-primary/5 ring-primary ring-1'
							: 'bg-background'}"
						onclick={() => (buildPack = 'docker-compose')}
					>
						<div class="font-medium">Compose</div>
						<span class="text-muted-foreground text-[10px]">Multi-container</span>
					</button>
				</div>
			</div>

			<Dialog.Footer>
				<div class="flex w-full justify-end gap-2">
					<Button type="button" variant="ghost" onclick={() => (showCreateModal = false)}>
						Cancel
					</Button>
					<Button
						type="submit"
						loading={isCreating}
						disabled={data.sources.length === 0 || data.destinations.length === 0}
					>
						Create Application
					</Button>
				</div>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
