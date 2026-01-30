<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import { toastStore } from '$lib/stores/toast';
	import { projectsApi } from '$lib/api/resources/projects';
	import { formatDate } from '$lib/utils/helpers';
	import { enhance } from '$app/forms';
	import { createRepositoryRemote } from '../../git.remote';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Label } from '$lib/components/ui/label';
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/ui/table';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import {
		LayoutGrid,
		Info,
		Users,
		ArrowLeft,
		Settings,
		Trash2,
		ExternalLink,
		User,
		Pencil,
		GitBranch,
		Copy,
		Plus,
		Check
	} from '@lucide/svelte';
	import type { PageData } from './$types';
	import PageTitle from '$lib/components/PageTitle.svelte';

	let { data }: { data: PageData } = $props();

	let showEditModal = $state(false);
	let showDeleteModal = $state(false);
	let name = $state(untrack(() => data.project.name));
	let description = $state(untrack(() => data.project.description || ''));
	let clientId = $state(untrack(() => data.project.clientId || ''));

	// Keep local state in sync with server data
	$effect(() => {
		name = data.project.name;
		description = data.project.description || '';
		clientId = data.project.clientId || '';
	});
	let isUpdating = $state(false);
	let isDeleting = $state(false);
	
	// Git Repository state
	let showCreateRepoModal = $state(false);
	let repoName = $state('');
	let repoDescription = $state('');
	let isPrivate = $state(false);
	let isCreatingRepo = $state(false);
	let copiedUrl = $state<string | null>(null);

	async function handleDelete() {
		isDeleting = true;

		try {
			await projectsApi.delete(data.project.id);
			toastStore.success('Project deleted successfully');
			goto('/projects');
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to delete project');
		} finally {
			isDeleting = false;
		}
	}
</script>

<PageTitle title={data.project.name} />

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<div class="mb-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
				<a href="/projects" class="hover:text-gray-700 dark:hover:text-gray-300">Projects</a>
				<span>/</span>
				<span>{data.project.name}</span>
			</div>
			<div class="flex items-center gap-3">
				<h1 class="text-3xl font-bold text-gray-900 dark:text-white">{data.project.name}</h1>
				{#if data.project.isShared}
					<Badge
						variant="secondary"
						class="flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase"
					>
						<Users class="size-3" />
						Shared Project
					</Badge>
				{/if}
			</div>
			{#if data.project.description}
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					{data.project.description}
				</p>
			{/if}
		</div>
		<div class="flex gap-3">
			<Button variant="outline" onclick={() => (showEditModal = true)}>
				<Pencil class="mr-2 size-4" />
				Edit Settings
			</Button>
			<Button variant="destructive" onclick={() => (showDeleteModal = true)}>
				<Trash2 class="mr-2 size-4" />
				Delete
			</Button>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="space-y-6 lg:col-span-2">
			<!-- Environments -->
			<Card.Root>
				<Card.Header>
					<div class="flex items-center gap-2">
						<LayoutGrid class="text-muted-foreground size-4" />
						<Card.Title>Environments</Card.Title>
					</div>
					<Card.Description>Logical environments for this project.</Card.Description>
				</Card.Header>
				<Card.Content class="p-0">
					{#if data.project.environments && data.project.environments.length > 0}
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Environment</TableHead>
									<TableHead>Description</TableHead>
									<TableHead class="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each data.project.environments as environment}
									<TableRow>
										<TableCell class="font-medium">{environment.name}</TableCell>
										<TableCell class="text-muted-foreground text-sm">
											{environment.description || 'No description'}
										</TableCell>
										<TableCell class="text-right">
											<Button
												variant="ghost"
												size="sm"
												href={`/projects/${data.project.id}/${environment.id}`}
											>
												<ExternalLink class="mr-1.5 size-3.5" />
												Enter
											</Button>
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					{:else}
						<div class="py-10 text-center">
							<p class="text-muted-foreground text-sm italic">No environments yet</p>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Team Access -->
			<Card.Root>
				<Card.Header>
					<div class="flex items-center gap-2">
						<Users class="text-muted-foreground size-4" />
						<Card.Title>Team Access</Card.Title>
					</div>
					<Card.Description>Manage which teams have access to this project.</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if data.sharedTeams && data.sharedTeams.length > 0}
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Team</TableHead>
									<TableHead>Role</TableHead>
									<TableHead class="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each data.sharedTeams as shared}
									<TableRow>
										<TableCell class="font-medium">{shared.team.name}</TableCell>
										<TableCell>
											<Badge variant="outline" class="capitalize">{shared.role}</Badge>
										</TableCell>
										<TableCell class="text-right">
											{#if !data.project.isShared}
												<form method="POST" action="?/unshare" use:enhance class="inline-block">
													<input type="hidden" name="teamId" value={shared.team.id} />
													<Button
														type="submit"
														variant="ghost"
														size="sm"
														class="text-destructive hover:bg-destructive/10"
													>
														Revoke Access
													</Button>
												</form>
											{:else}
												<span class="text-muted-foreground text-xs italic">Managed by owner</span>
											{/if}
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					{:else}
						<div class="text-muted-foreground py-6 text-center text-sm">
							This project is not shared with any other teams.
						</div>
					{/if}
				</Card.Content>
				{#if !data.project.isShared}
					<Card.Footer class="flex-col items-start gap-4 border-t pt-6">
						<h4 class="text-sm font-semibold">Share with another team</h4>
						<form
							method="POST"
							action="?/share"
							use:enhance
							class="flex w-full items-end gap-4"
							autocomplete="off"
						>
							<div class="w-full max-w-sm space-y-2">
								<Label class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
									>Select Team</Label
								>
								<select
									name="teamId"
									class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
									required
								>
									<option value="" disabled selected>Select a team</option>
									{#if data.allTeams}
										{#each data.allTeams as team}
											<option value={team.id}>{team.name}</option>
										{/each}
									{/if}
								</select>
							</div>
							<div class="w-32 space-y-2">
								<Label class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
									>Role</Label
								>
								<select
									name="role"
									class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
								>
									<option value="viewer">Viewer</option>
									<option value="editor" selected>Editor</option>
									<option value="admin">Admin</option>
								</select>
							</div>
							<Button type="submit" size="default">Share Project</Button>
						</form>
					</Card.Footer>
				{/if}
			</Card.Root>

			<!-- Git Repository -->
			<Card.Root>
				<Card.Header>
					<div class="flex items-center gap-2">
						<GitBranch class="text-muted-foreground size-4" />
						<Card.Title>Git Repository</Card.Title>
					</div>
					<Card.Description>Built-in Git repository for this project.</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if data.gitRepository}
						<div class="space-y-6">
							<!-- Repository Info -->
							<div class="space-y-3">
								<div>
									<dt class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase mb-1.5">
										Repository
									</dt>
									<dd class="font-semibold text-base">{data.gitRepository.name}</dd>
									{#if data.gitRepository.description}
										<p class="text-muted-foreground mt-1 text-sm">{data.gitRepository.description}</p>
									{/if}
								</div>
								
								<div class="flex items-center gap-2">
									<Badge variant={data.gitRepository.isPrivate ? 'default' : 'outline'}>
										{data.gitRepository.isPrivate ? 'Private' : 'Public'}
									</Badge>
									<div class="text-muted-foreground flex items-center gap-3 text-xs">
										<span>{data.gitRepository.commitCount} commits</span>
										<span>•</span>
										<span>{data.gitRepository.branchCount} branches</span>
										<span>•</span>
										<span>{data.gitRepository.tagCount} tags</span>
									</div>
								</div>
								
								{#if data.gitRepository.lastCommitAt}
									<div class="text-muted-foreground text-xs">
										Last commit: {formatDate(data.gitRepository.lastCommitAt.toString())}
									</div>
								{/if}
							</div>
							
							<!-- Clone URLs -->
							<div class="border-t pt-4">
								<dt class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase mb-3">
									Clone Repository
								</dt>
								<div class="space-y-3">
									<!-- HTTP/HTTPS URL -->
									{#if typeof window !== 'undefined' && data.gitRepository.namespace}
										<div class="space-y-1.5">
											<div class="bg-muted/30 border-border/50 group relative flex items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50">
												<code class="flex-1 truncate font-mono text-xs">
													{window.location.origin}/{data.gitRepository.namespace}/{data.gitRepository.name}.git
												</code>
												<Button
													variant="ghost"
													size="sm"
													class="h-7 w-7 flex-shrink-0 p-0"
													onclick={async () => {
														const url = `${window.location.origin}/${data.gitRepository.namespace}/${data.gitRepository.name}.git`;
														await navigator.clipboard.writeText(url);
														copiedUrl = 'http';
														setTimeout(() => copiedUrl = null, 2000);
													}}
												>
													{#if copiedUrl === 'http'}
														<Check class="size-3.5 text-green-600" />
													{:else}
														<Copy class="size-3.5" />
													{/if}
												</Button>
											</div>
											<p class="text-muted-foreground text-[10px]">HTTP/HTTPS (Recommended)</p>
										</div>
										
										<!-- Git protocol URL -->
										<div class="space-y-1.5">
											<div class="bg-muted/20 border-border/30 group relative flex items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/30">
												<code class="flex-1 truncate font-mono text-xs">
													git://{window.location.hostname}/{data.gitRepository.namespace}/{data.gitRepository.name}.git
												</code>
												<Button
													variant="ghost"
													size="sm"
													class="h-7 w-7 flex-shrink-0 p-0"
													onclick={async () => {
														const url = `git://${window.location.hostname}/${data.gitRepository.namespace}/${data.gitRepository.name}.git`;
														await navigator.clipboard.writeText(url);
														copiedUrl = 'git';
														setTimeout(() => copiedUrl = null, 2000);
													}}
												>
													{#if copiedUrl === 'git'}
														<Check class="size-3.5 text-green-600" />
													{:else}
														<Copy class="size-3.5" />
													{/if}
												</Button>
											</div>
											<p class="text-muted-foreground text-[10px]">Git Protocol (Requires server configuration)</p>
										</div>
									{:else}
										<div class="bg-muted/30 border-border/50 rounded-lg border p-3">
											<p class="text-muted-foreground text-xs italic">Namespace not available</p>
										</div>
									{/if}
								</div>
							</div>
						</div>
					{:else}
						<div class="py-8 text-center">
							<div class="bg-muted/30 border-border/50 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border">
								<GitBranch class="text-muted-foreground size-5" />
							</div>
							<p class="text-muted-foreground mb-1 text-sm font-medium">No Git repository</p>
							<p class="text-muted-foreground mb-6 text-xs">
								Create a repository to start version controlling your project.
							</p>
							<Button onclick={() => (showCreateRepoModal = true)}>
								<Plus class="mr-2 size-4" />
								Create Repository
							</Button>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>

		<div class="space-y-6">
			<!-- Project Info -->
			<Card.Root>
				<Card.Header>
					<div class="flex items-center gap-2">
						<Info class="text-muted-foreground size-4" />
						<Card.Title>Settings</Card.Title>
					</div>
				</Card.Header>
				<Card.Content>
					<dl class="space-y-4">
						<div>
							<dt class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
								Project ID
							</dt>
							<dd
								class="text-foreground bg-muted/50 mt-1 truncate rounded px-2 py-1 font-mono text-xs"
							>
								{data.project.id}
							</dd>
						</div>
						<div>
							<dt class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
								Assigned Client
							</dt>
							<dd class="mt-1">
								{#if data.project.client}
									<a
										href="/clients/{data.project.client.id}"
										class="bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors"
									>
										<User class="size-3" />
										<span class="text-xs font-medium">{data.project.client.name}</span>
									</a>
								{:else}
									<span class="text-muted-foreground text-sm italic">No client assigned</span>
								{/if}
							</dd>
						</div>
						<div class="border-t border-dashed pt-4">
							<dt class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
								Created
							</dt>
							<dd class="text-foreground mt-1 text-sm">
								{formatDate(data.project.createdAt.toString())}
							</dd>
						</div>
						<div>
							<dt class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
								Last Activity
							</dt>
							<dd class="text-foreground mt-1 text-sm">
								{formatDate(data.project.updatedAt.toString())}
							</dd>
						</div>
					</dl>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>

<Dialog.Root bind:open={showEditModal}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Edit Project</Dialog.Title>
			<Dialog.Description>Update project details and client assignment.</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				isUpdating = true;
				return async ({ result }) => {
					isUpdating = false;
					if (result.type === 'success') {
						showEditModal = false;
						toastStore.success('Project updated successfully');
						await invalidateAll();
					}
				};
			}}
			class="space-y-4 pt-4"
			autocomplete="off"
		>
			<div class="space-y-2">
				<Label for="name">Project Name</Label>
				<Input id="name" name="name" bind:value={name} placeholder="Production" required />
			</div>

			<div class="space-y-2">
				<Label for="description">Description (Optional)</Label>
				<Input
					id="description"
					name="description"
					bind:value={description}
					placeholder="Main production environment for our SaaS"
				/>
			</div>

			<div class="space-y-2">
				<Label for="clientId">Assigned Client</Label>
				<select
					id="clientId"
					name="clientId"
					bind:value={clientId}
					class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
				>
					<option value="">No Client (Unassigned)</option>
					{#each data.clients as client}
						<option value={client.id}
							>{client.name} {client.company ? `(${client.company})` : ''}</option
						>
					{/each}
				</select>
			</div>

			<Dialog.Footer class="pt-4">
				<Button type="button" variant="ghost" onclick={() => (showEditModal = false)}>
					Cancel
				</Button>
				<Button type="submit" loading={isUpdating}>Save Changes</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={showDeleteModal}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Delete Project</Dialog.Title>
			<Dialog.Description>
				This action is permanent and will delete all environments within this project.
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-4">
			<div class="bg-destructive/10 border-destructive/20 rounded-md border p-4">
				<p class="text-destructive text-sm font-medium">
					Are you sure you want to delete <strong>{data.project.name}</strong>?
				</p>
			</div>

			<Dialog.Footer>
				<Button variant="ghost" onclick={() => (showDeleteModal = false)}>Cancel</Button>
				<Button variant="destructive" loading={isDeleting} onclick={handleDelete}>
					Delete Project
				</Button>
			</Dialog.Footer>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Create Repository Dialog -->
<Dialog.Root bind:open={showCreateRepoModal}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Create Git Repository</Dialog.Title>
			<Dialog.Description>
				Create a built-in Git repository for this project.
			</Dialog.Description>
		</Dialog.Header>

		<form
			onsubmit={async (e) => {
				e.preventDefault();
				if (!repoName.trim()) {
					toastStore.error('Repository name is required');
					return;
				}
				
				isCreatingRepo = true;
				try {
					const response = await createRepositoryRemote({
						projectId: data.project.id,
						name: repoName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
						description: repoDescription.trim() || null,
						isPrivate: isPrivate
					});
					
					if (!response.success) {
						throw new Error(response.message || 'Failed to create repository');
					}
					
					toastStore.success('Repository created successfully');
					showCreateRepoModal = false;
					repoName = '';
					repoDescription = '';
					isPrivate = false;
					await invalidateAll();
				} catch (error: any) {
					toastStore.error(error.message || 'Failed to create repository');
				} finally {
					isCreatingRepo = false;
				}
			}}
			class="pt-4"
		>
			<div class="space-y-4">
				<div class="grid gap-2">
					<Label for="repoName">Repository Name</Label>
					<Input
						id="repoName"
						bind:value={repoName}
						placeholder="my-repository"
						required
						pattern="[a-z0-9-]+"
						title="Only lowercase letters, numbers, and hyphens"
					/>
					<p class="text-muted-foreground text-xs">
						Lowercase letters, numbers, and hyphens only. Will be used as the repository slug.
					</p>
				</div>

				<div class="grid gap-2">
					<Label for="repoDescription">Description (Optional)</Label>
					<Input
						id="repoDescription"
						bind:value={repoDescription}
						placeholder="Repository description..."
					/>
				</div>

				<div class="flex items-center gap-2">
					<input
						type="checkbox"
						id="isPrivate"
						bind:checked={isPrivate}
						class="h-4 w-4 rounded border-gray-300"
					/>
					<Label for="isPrivate" class="cursor-pointer">Make this repository private</Label>
				</div>
			</div>

			<Dialog.Footer class="pt-6">
				<Button type="button" variant="outline" onclick={() => (showCreateRepoModal = false)}>
					Cancel
				</Button>
				<Button type="submit" disabled={isCreatingRepo}>
					{isCreatingRepo ? 'Creating...' : 'Create Repository'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
