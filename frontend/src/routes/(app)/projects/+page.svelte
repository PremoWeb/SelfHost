<script lang="ts">
	import { goto } from '$app/navigation';
	import { toastStore } from '$lib/stores/toast';
	import { projectsApi } from '$lib/api/resources/projects';
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import StickyHeader from '$lib/components/StickyHeader.svelte';
	import {
		Plus,
		Search,
		Folder,
		Users,
		Globe,
		User,
		ArrowUpDown,
		Filter,
		LayoutGrid,
		List
	} from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge';

	let { data }: { data: PageData } = $props();

	let showAddModal = $state(false);
	let name = $state('');
	let description = $state('');
	let isCreating = $state(false);
	let searchQuery = $state('');
	let sortBy = $state<'date' | 'name' | 'client'>('date');
	let layoutMode = $state<'grid' | 'grouped'>('grid');
	let selectedClientId = $state('');

	let sortedProjects = $derived(
		[...data.projects].sort((a, b) => {
			if (sortBy === 'name') return a.name.localeCompare(b.name);
			if (sortBy === 'client') {
				const clientA = a.client?.name || '';
				const clientB = b.client?.name || '';
				return clientA.localeCompare(clientB);
			}
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		})
	);

	let filteredProjects = $derived(
		sortedProjects.filter(
			(p) =>
				p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				p.client?.name?.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	let groupedProjects = $derived(
		filteredProjects.reduce(
			(acc, project) => {
				const clientName = project.client?.name || 'Unassigned Projects';
				if (!acc[clientName]) acc[clientName] = [];
				acc[clientName].push(project);
				return acc;
			},
			{} as Record<string, typeof filteredProjects>
		)
	);

	async function handleCreateSubmit(e: Event) {
		e.preventDefault();
		if (!name.trim()) return;
		isCreating = true;
		try {
			const res = await projectsApi.create({
				name: name.trim(),
				description: description.trim() || undefined,
				clientId: selectedClientId || undefined
			});
			const created = (res as { data?: { data?: { id?: string } } }).data?.data;
			toastStore.success('Project created');
			showAddModal = false;
			name = '';
			description = '';
			selectedClientId = '';
			if (created?.id) {
				goto(`/projects/${created.id}`);
			}
		} catch (err: unknown) {
			const msg =
				(err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
				'Failed to create project';
			toastStore.error(msg);
		} finally {
			isCreating = false;
		}
	}
</script>

<PageTitle title="Projects" />

<div class="space-y-6">
	<StickyHeader class="space-y-4">
		<div class="flex items-center justify-between">
			<div class="flex flex-col gap-1">
				<h1 class="text-3xl font-bold tracking-tight">Projects</h1>
				<p class="text-muted-foreground">Logical grouping for your applications and services.</p>
			</div>
			<Button onclick={() => (showAddModal = true)}>
				<Plus class="mr-2 size-4" />
				New Project
			</Button>
		</div>

		<div class="flex items-center gap-4">
			<div class="relative flex-1">
				<Search class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
				<Input
					bind:value={searchQuery}
					placeholder="Search projects by name, description, or client..."
					class="h-11 pl-10"
					autofocus
				/>
			</div>
			<div class="bg-muted/50 flex h-11 items-center gap-2 rounded-lg border px-3 py-1">
				<span class="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase">
					<ArrowUpDown class="size-3" />
					Sort By:
				</span>
				<select
					bind:value={sortBy}
					class="cursor-pointer bg-transparent text-sm font-medium focus:outline-none"
				>
					<option value="date">Date Created</option>
					<option value="name">Project Name</option>
					<option value="client">Client Name</option>
				</select>
			</div>
			<div class="bg-muted/50 flex h-11 items-center gap-1 rounded-lg border p-1">
				<Button
					variant={layoutMode === 'grid' ? 'secondary' : 'ghost'}
					size="icon"
					class="size-9"
					onclick={() => (layoutMode = 'grid')}
				>
					<LayoutGrid class="size-4" />
				</Button>
				<Button
					variant={layoutMode === 'grouped' ? 'secondary' : 'ghost'}
					size="icon"
					class="size-9"
					onclick={() => (layoutMode = 'grouped')}
				>
					<List class="size-4" />
				</Button>
			</div>
		</div>
	</StickyHeader>

	{#if filteredProjects.length > 0}
		{#if layoutMode === 'grid'}
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredProjects as project}
					<Card.Root class="group transition-all hover:shadow-md">
						<Card.Header>
							<div class="flex items-start justify-between">
								<div class="flex items-center gap-2">
									<Folder
										class="text-muted-foreground group-hover:text-primary size-4 transition-colors"
									/>
									<a href="/projects/{project.id}" class="hover:underline">
										<Card.Title>{project.name}</Card.Title>
									</a>
								</div>
								{#if project.isShared}
									<Badge
										variant="secondary"
										class="flex h-5 items-center gap-1 px-1.5 text-[10px] font-normal uppercase"
									>
										<Users class="size-2.5" />
										Shared
									</Badge>
								{/if}
								{#if project.client}
									<a href="/clients/{project.client.id}">
										<Badge
											variant="outline"
											class="bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 flex h-5 items-center gap-1 px-1.5 text-[10px] font-normal uppercase transition-colors"
										>
											<User class="size-2.5" />
											{project.client.name}
										</Badge>
									</a>
								{/if}
							</div>
							{#if project.description}
								<Card.Description class="mt-2 line-clamp-2">{project.description}</Card.Description>
							{/if}
						</Card.Header>
						<Card.Footer class="flex items-center justify-between pt-0">
							<div class="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
								{#if project.isShared}
									{#if project.team}
										Team: {project.team.name}
									{:else}
										Shared by others
									{/if}
								{:else}
									Your Project
								{/if}
							</div>
							{#if project.isShared}
								<Badge variant="outline" class="h-5 py-0 text-[10px] font-bold uppercase"
									>{project.role}</Badge
								>
							{/if}
						</Card.Footer>
					</Card.Root>
				{/each}
			</div>
		{:else}
			<div class="space-y-8">
				{#each Object.entries(groupedProjects) as [clientName, projects]}
					<div class="space-y-4">
						<div class="flex items-center gap-3">
							<div class="bg-border sticky top-0 h-px flex-1"></div>
							<h2
								class="text-muted-foreground flex items-center gap-2 text-sm font-bold tracking-widest whitespace-nowrap uppercase"
							>
								{#if clientName === 'Unassigned Projects'}
									<Folder class="size-4" />
									{clientName}
								{:else}
									<User class="size-4" />
									<a href="/clients/{projects[0].clientId}" class="hover:underline">
										{clientName}
									</a>
								{/if}
							</h2>
							<div class="bg-border h-px flex-1"></div>
						</div>
						<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{#each projects as project}
								<Card.Root class="group transition-all hover:shadow-md">
									<Card.Header>
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<Folder
													class="text-muted-foreground group-hover:text-primary size-4 transition-colors"
												/>
												<a href="/projects/{project.id}" class="hover:underline">
													<Card.Title>{project.name}</Card.Title>
												</a>
											</div>
											{#if project.isShared}
												<Badge
													variant="secondary"
													class="flex h-5 items-center gap-1 px-1.5 text-[10px] font-normal uppercase"
												>
													<Users class="size-2.5" />
												</Badge>
											{/if}
										</div>
										{#if project.description}
											<Card.Description class="mt-1 line-clamp-2"
												>{project.description}</Card.Description
											>
										{/if}
									</Card.Header>
								</Card.Root>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		<div class="bg-muted/20 rounded-lg border-2 border-dashed py-20 text-center">
			<Folder class="text-muted-foreground mx-auto mb-4 size-10 opacity-20" />
			<p class="text-muted-foreground">
				No projects found. {searchQuery
					? 'Try a different search term.'
					: 'Create your first project to get started.'}
			</p>
		</div>
	{/if}
</div>

<Dialog.Root bind:open={showAddModal}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Create Project</Dialog.Title>
			<Dialog.Description>Group assets and manage them collectively.</Dialog.Description>
		</Dialog.Header>
		<form
			onsubmit={handleCreateSubmit}
			class="space-y-4 pt-4"
			autocomplete="off"
		>
			<div class="space-y-2">
				<Label for="name">Project Name</Label>
				<Input id="name" name="name" bind:value={name} placeholder="Production" required />
			</div>
			<div class="space-y-2">
				<Label for="description">Description</Label>
				<Input
					id="description"
					name="description"
					bind:value={description}
					placeholder="Main production environment"
				/>
			</div>
			<div class="space-y-2">
				<Label for="client">Assign Client (Optional)</Label>
				<select
					id="client"
					name="clientId"
					bind:value={selectedClientId}
					class="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
				>
					<option value="">No Client</option>
					{#each data.clients as client}
						<option value={client.id}
							>{client.name} {client.company ? `(${client.company})` : ''}</option
						>
					{/each}
				</select>
				<p class="text-muted-foreground text-[10px]">
					Manage clients in the <a href="/clients" class="underline">CRM section</a>.
				</p>
			</div>
			<Dialog.Footer>
				<Button type="submit" class="w-full" disabled={isCreating}>
					{isCreating ? 'Creating...' : 'Create Project'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
