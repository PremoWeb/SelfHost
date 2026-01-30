<script lang="ts">
	import { goto, invalidateAll, replaceState } from '$app/navigation';
	import { browser } from '$app/environment';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import { formatDate } from '$lib/utils/helpers';
	import { updateRepositorySettingsRemote } from '../git.remote';
	import { createTunnelRemote } from '../servers.remote';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Badge } from '$lib/components/ui/badge';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import StickyHeader from '$lib/components/StickyHeader.svelte';
	import {
		Github,
		Gitlab,
		GitBranch,
		Plus,
		Trash2,
		ExternalLink,
		Globe,
		Wifi,
		Settings,
		Lock,
		Unlock,
		Eye,
		EyeOff,
		FileCode,
		Key,
		Copy,
		Check
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showCreateModal = $state(false);
	let name = $state('');
	let description = $state('');
	let type = $state('github');
	let apiUrl = $state('https://api.github.com');
	let htmlUrl = $state('https://github.com');
	let token = $state('');
	let isCreating = $state(false);
	let isDeleting = $state(false);
	
	// Git Repository Management State
	let selectedRepo = $state<any>(null);
	let showRepoSettingsModal = $state(false);
	let repoSettings = $state({
		name: '',
		description: '',
		isPrivate: false,
		allowHttpPush: true,
		allowSshPush: true,
		isTemplate: false,
		isReadOnly: false
	});
	let isUpdatingRepo = $state(false);
	let copiedUrl = $state<string | null>(null);

	// GitHub App State
	let githubAuthMethod = $state('app'); // 'app' | 'pat'

	// Tunnel State
	let tunnelUrl = $state<string | null>(null);
	let isStartingTunnel = $state(false);
	let isLocalhost = $state(false);

	$effect(() => {
		if (browser) {
			isLocalhost =
				window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
			checkTunnelStatus();

			// Check for GitHub App registration status
			const params = new URLSearchParams(window.location.search);
			if (params.get('github_app') === 'success') {
				toastStore.success(
					'GitHub App registered successfully! Repositories are now accessible.',
					10000
				);
				// Clean up URL
				replaceState('/sources', {});
			} else if (params.get('github_app') === 'error') {
				toastStore.error('Failed to register GitHub App');
				replaceState('/sources', {});
			}
		}
	});

	async function checkTunnelStatus() {
		if (!isLocalhost) return;
		try {
			// Note: GET endpoint for tunnel status doesn't have a remote function yet
			// Keeping as api.get for now since it's just a status check
			const res = await api.get<{ url: string }>('/dev/tunnel');
			if (res.data.url) {
				tunnelUrl = res.data.url;
			}
		} catch (e) {
			// Setup silence
		}
	}

	async function startTunnel() {
		isStartingTunnel = true;
		try {
			const response = await createTunnelRemote({});
			if (response.success && response.data) {
				tunnelUrl = response.data.url;
				toastStore.success('Public tunnel activated');
			} else {
				toastStore.error(response.message || 'Failed to start tunnel');
			}
		} catch (error: any) {
			toastStore.error(error.message || 'Failed to start tunnel');
		} finally {
			isStartingTunnel = false;
		}
	}

	async function handleCreate() {
		if (!name || (!token && type !== 'github')) {
			toastStore.error('Name and credentials are required');
			return;
		}

		// If GitHub App, we don't create via API directly here, we redirect.
		// But for PAT or other providers:
		isCreating = true;
		try {
			await api.post('/sources', { name, description, type, apiUrl, htmlUrl, token });
			toastStore.success('Source created successfully');
			showCreateModal = false;
			resetForm();
			goto('/sources', { invalidateAll: true });
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to create source');
		} finally {
			isCreating = false;
		}
	}

	function registerGithubApp() {
		if (!browser) return;
		
		if (!name) {
			toastStore.error('Please name your source first');
			return;
		}

		const baseUrl = tunnelUrl || window.location.origin;

		if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
			toastStore.error('GitHub Apps require a public URL. Please start the tunnel first.');
			return;
		}

		const manifest = {
			name: `SelfHost-${name.replace(/\s+/g, '-')}-${Date.now().toString().slice(-4)}`,
			url: baseUrl,
			hook_attributes: {
				url: `${baseUrl}/webhooks/github/events`,
				active: true
			},
			redirect_url: `${baseUrl}/webhooks/github/callback`,
			public: false,
			default_permissions: {
				contents: 'read',
				metadata: 'read',
				pull_requests: 'read',
				emails: 'read',
				administration: 'read'
			},
			default_events: ['pull_request', 'push']
		};

		const form = document.createElement('form');
		form.action = 'https://github.com/settings/apps/new';
		form.method = 'POST';

		const input = document.createElement('input');
		input.type = 'hidden';
		input.name = 'manifest';
		input.value = JSON.stringify(manifest);

		form.appendChild(input);
		document.body.appendChild(form);
		form.submit();
		document.body.removeChild(form);
	}

	// ... rest of existing functions ...

	async function handleDelete(id: string) {
		if (
			!confirm(
				'Are you sure you want to delete this source? This might break applications using it.'
			)
		)
			return;

		isDeleting = true;
		try {
			await api.delete(`/sources/${id}`);
			toastStore.success('Source deleted successfully');
			goto('/sources', { invalidateAll: true });
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to delete source');
		} finally {
			isDeleting = false;
		}
	}

	function resetForm() {
		name = '';
		description = '';
		token = '';
		type = 'github';
		apiUrl = 'https://api.github.com';
		htmlUrl = 'https://github.com';
		githubAuthMethod = 'app';
	}

	function getIcon(type: string) {
		switch (type) {
			case 'github':
				return Github;
			case 'gitlab':
				return Gitlab;
			case 'bitbucket':
				return GitBranch;
			default:
				return GitBranch;
		}
	}
</script>

<PageTitle title="Sources" />

<div class="space-y-6">
	<StickyHeader>
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">Sources</h1>
				<p class="text-muted-foreground mt-1">
					Manage external Git providers and built-in repositories.
				</p>
			</div>
			<Button onclick={() => (showCreateModal = true)}>
				<Plus class="mr-2 size-4" />
				Add Source
			</Button>
		</div>
	</StickyHeader>

	<!-- Built-in Repositories Section -->
	{#if data.builtInRepos && data.builtInRepos.length > 0}
		<div class="space-y-4">
			<div>
				<h2 class="text-xl font-semibold">Built-in Repositories</h2>
				<p class="text-muted-foreground text-sm">
					Git repositories hosted directly in SelfHost for your projects.
				</p>
			</div>
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.builtInRepos as repo}
					<Card.Root class="group relative overflow-hidden transition-all hover:shadow-md">
						<Card.Header>
							<div class="flex items-start justify-between">
								<div class="flex items-center gap-3 flex-1 min-w-0">
									<div class="bg-muted rounded-lg p-2 flex-shrink-0">
										<GitBranch class="size-5" />
									</div>
									<div class="space-y-1 min-w-0 flex-1">
										<Card.Title class="text-base truncate">{repo.name}</Card.Title>
										<div class="flex items-center gap-1.5 flex-wrap">
											<Badge variant="outline" class="text-xs">SelfHost</Badge>
											{#if repo.isPrivate}
												<Badge variant="secondary" class="text-xs">Private</Badge>
											{:else}
												<Badge variant="outline" class="text-xs">Public</Badge>
											{/if}
											{#if repo.isTemplate}
												<Badge variant="default" class="text-xs">
													<FileCode class="mr-1 size-3" />
													Template
												</Badge>
											{/if}
											{#if repo.isReadOnly}
												<Badge variant="destructive" class="text-xs">
													<Lock class="mr-1 size-3" />
													Read-Only
												</Badge>
											{/if}
										</div>
									</div>
								</div>
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
									onclick={(e) => {
										e.stopPropagation();
										selectedRepo = repo;
										repoSettings = {
											name: repo.name,
											description: repo.description || '',
											isPrivate: repo.isPrivate,
											allowHttpPush: repo.allowHttpPush,
											allowSshPush: repo.allowSshPush,
											isTemplate: repo.isTemplate || false,
											isReadOnly: repo.isReadOnly || false
										};
										showRepoSettingsModal = true;
									}}
								>
									<Settings class="size-4" />
								</Button>
							</div>
						</Card.Header>
						<Card.Content>
							<div class="space-y-3">
								{#if repo.description}
									<p class="text-muted-foreground line-clamp-2 text-sm">
										{repo.description}
									</p>
								{/if}
								
								<div class="text-muted-foreground text-xs">
									Project: <a href="/projects/{repo.project.id}" class="font-medium hover:underline">{repo.project.name}</a>
								</div>
								
								<!-- Clone URL -->
								{#if browser && repo.namespace}
									<div class="bg-muted/30 border-border/50 rounded-lg border p-2">
										<div class="flex items-center gap-2">
											<code class="flex-1 truncate font-mono text-[10px]">
												{browser ? window.location.origin : ''}/{repo.namespace}/{repo.name}.git
											</code>
											<Button
												variant="ghost"
												size="sm"
												class="h-6 w-6 flex-shrink-0 p-0"
												onclick={async (e) => {
													e.stopPropagation();
													if (browser) {
														const url = `${window.location.origin}/${repo.namespace}/${repo.name}.git`;
														await navigator.clipboard.writeText(url);
														copiedUrl = repo.id;
														setTimeout(() => copiedUrl = null, 2000);
													}
												}}
											>
												{#if copiedUrl === repo.id}
													<Check class="size-3 text-green-600" />
												{:else}
													<Copy class="size-3" />
												{/if}
											</Button>
										</div>
									</div>
								{/if}
								
								<div class="flex items-center justify-between gap-2 pt-1">
									<div class="text-muted-foreground flex items-center gap-2 text-xs">
										<span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
										<span>{repo.commitCount} commits</span>
										<span>•</span>
										<span>{repo.branchCount} branches</span>
									</div>
									<div class="flex items-center gap-1">
										<Button
											variant="ghost"
											size="sm"
											class="h-7 text-xs"
											onclick={(e) => {
												e.stopPropagation();
												goto(`/projects/${repo.project.id}`);
											}}
										>
											View Project
										</Button>
									</div>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		</div>
	{/if}

	<!-- External Sources Section -->
	<div class="space-y-4">
		<div>
			<h2 class="text-xl font-semibold">External Git Providers</h2>
			<p class="text-muted-foreground text-sm">
				Connect external Git providers like GitHub, GitLab, or Bitbucket.
			</p>
		</div>

	{#if data.sources.length === 0}
		<Card.Root class="border-dashed">
			<Card.Content class="flex flex-col items-center justify-center py-12 text-center">
				<div class="bg-muted/50 mb-4 rounded-full p-4">
					<Github class="text-muted-foreground size-8" />
				</div>
				<h3 class="text-lg font-semibold">No sources connected</h3>
				<p class="text-muted-foreground mt-1 mb-6 max-w-sm text-sm">
					Connect a Git provider like GitHub, GitLab, or Bitbucket to start deploying your
					applications.
				</p>
				<Button onclick={() => (showCreateModal = true)}>Connect Source</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.sources as source}
				{@const Icon = getIcon(source.type)}
				<Card.Root
					class="group relative cursor-pointer overflow-hidden transition-all hover:shadow-md"
					onclick={() => goto(`/sources/${source.id}`)}
				>
					<Card.Header>
						<div class="flex items-start justify-between">
							<div class="flex items-center gap-3">
								<div class="bg-muted rounded-lg p-2">
									<Icon class="size-5" />
								</div>
								<div class="space-y-1">
									<Card.Title class="text-base">{source.name}</Card.Title>
									<Badge variant="outline" class="capitalize">{source.type}</Badge>
								</div>
							</div>
							<Button
								variant="ghost"
								size="icon"
								class="text-destructive hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-2 opacity-0 transition-opacity group-hover:opacity-100"
								onclick={(e) => {
									e.stopPropagation();
									handleDelete(source.id);
								}}
							>
								<Trash2 class="size-4" />
							</Button>
						</div>
					</Card.Header>
					<Card.Content>
						{#if source.description}
							<p class="text-muted-foreground mb-4 line-clamp-2 text-sm">
								{source.description}
							</p>
						{/if}
						<div class="flex items-center justify-between gap-2">
							<div class="text-muted-foreground flex items-center gap-1 text-xs">
								<span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
								Connected {formatDate(source.createdAt.toString())}
							</div>
							<Button
								variant="ghost"
								size="sm"
								class="h-7 text-xs opacity-0 transition-opacity group-hover:opacity-100"
								onclick={(e) => {
									e.stopPropagation();
									goto(`/sources/${source.id}`);
								}}
							>
								View Repos
							</Button>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
	</div>
</div>

<Dialog.Root bind:open={showCreateModal}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Connect Git Provider</Dialog.Title>
			<Dialog.Description>Add a new Git source to deploy your repositories.</Dialog.Description>
		</Dialog.Header>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleCreate();
			}}
			class="pt-4"
			autocomplete="off"
		>
			<div class="space-y-4">
				<div class="grid gap-2">
					<Label for="name">Name</Label>
					<Input id="name" bind:value={name} placeholder="e.g. My GitHub" required />
				</div>

				<div class="grid gap-2">
					<Label for="type">Provider Type</Label>
					<select
						id="type"
						bind:value={type}
						class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						<option value="github">GitHub</option>
						<option value="gitlab">GitLab</option>
						<option value="bitbucket">Bitbucket</option>
						<option value="custom">Custom Git</option>
					</select>
				</div>

				{#if type === 'github'}
					<div class="bg-muted/20 rounded-md border p-4">
						<Tabs.Root bind:value={githubAuthMethod} class="w-full">
							<Tabs.List class="mb-4 grid w-full grid-cols-2">
								<Tabs.Trigger value="app">GitHub App (Recommended)</Tabs.Trigger>
								<Tabs.Trigger value="pat">Access Token</Tabs.Trigger>
							</Tabs.List>
							<Tabs.Content value="app">
								<div class="space-y-4">
									<div class="text-muted-foreground text-sm">
										We will create a GitHub App in your account to manage access and webhooks
										automatically.
									</div>

									{#if isLocalhost}
										<div class="bg-background rounded-lg border p-3">
											<div class="mb-2 flex items-center justify-between">
												<div class="flex items-center gap-2 text-sm font-medium">
													<Wifi
														class="size-4 {tunnelUrl ? 'text-green-500' : 'text-muted-foreground'}"
													/>
													Public Tunnel Status
												</div>
												<Badge
													variant={tunnelUrl ? 'default' : 'outline'}
													class={tunnelUrl ? 'bg-green-500 hover:bg-green-600' : ''}
												>
													{tunnelUrl ? 'Active' : 'Inactive'}
												</Badge>
											</div>

											{#if tunnelUrl}
												<div
													class="bg-muted text-muted-foreground mb-2 truncate rounded p-2 font-mono text-[10px]"
												>
													{tunnelUrl}
												</div>
												<p class="flex items-center gap-1.5 text-xs font-medium text-green-600">
													<Globe class="size-3" />
													Ready for public webhooks
												</p>
											{:else}
												<p class="text-muted-foreground mb-3 text-xs">
													GitHub requires a public URL for webhooks. Since you are on localhost, you
													need to start a tunnel.
												</p>
												<Button
													size="sm"
													variant="secondary"
													class="w-full"
													onclick={startTunnel}
													disabled={isStartingTunnel}
												>
													{isStartingTunnel ? 'Starting Tunnel...' : 'Enable Public Tunnel'}
												</Button>
											{/if}
										</div>
									{/if}

									<Button
										type="button"
										variant="default"
										class="w-full"
										onclick={registerGithubApp}
										disabled={isLocalhost && !tunnelUrl}
									>
										<ExternalLink class="mr-2 size-4" />
										Register GitHub App
									</Button>
								</div>
							</Tabs.Content>
							<Tabs.Content value="pat">
								<div class="space-y-3">
									<div class="grid gap-2">
										<Label for="token">Personal Access Token</Label>
										<Input id="token" type="password" bind:value={token} placeholder="ghp_..." />
										<p class="text-muted-foreground text-[10px]">
											Create a PAT with <code>repo</code> and <code>admin:repo_hook</code> scopes.
										</p>
									</div>
								</div>
							</Tabs.Content>
						</Tabs.Root>
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-4">
						<div class="grid gap-2">
							<Label for="apiUrl">API URL</Label>
							<Input id="apiUrl" bind:value={apiUrl} required />
						</div>
						<div class="grid gap-2">
							<Label for="htmlUrl">HTML URL</Label>
							<Input id="htmlUrl" bind:value={htmlUrl} required />
						</div>
					</div>
					<div class="grid gap-2">
						<Label for="token">Access Token</Label>
						<Input id="token" type="password" bind:value={token} required />
					</div>
				{/if}

				<div class="grid gap-2">
					<Label for="description">Description (Optional)</Label>
					<Input
						id="description"
						bind:value={description}
						placeholder="Deployment source for team..."
					/>
				</div>
			</div>

			<Dialog.Footer class="pt-6">
				<Button type="button" variant="outline" onclick={() => (showCreateModal = false)}>
					Cancel
				</Button>
				{#if type !== 'github' || githubAuthMethod === 'pat'}
					<Button type="submit" disabled={isCreating}>
						{isCreating ? 'Connecting...' : 'Connect Source'}
					</Button>
				{/if}
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Repository Settings Dialog -->
<Dialog.Root bind:open={showRepoSettingsModal}>
	<Dialog.Content class="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Repository Settings</Dialog.Title>
			<Dialog.Description>
				Manage settings for <strong>{selectedRepo?.name}</strong>
			</Dialog.Description>
		</Dialog.Header>

		{#if selectedRepo}
			<div class="space-y-6 pt-4">
				<!-- Basic Information -->
				<div class="space-y-4">
					<h3 class="text-sm font-semibold">Basic Information</h3>
					
					<div class="grid gap-2">
						<Label for="repo-name">Repository Name</Label>
						<Input
							id="repo-name"
							bind:value={repoSettings.name}
							placeholder="my-repository"
							pattern="[a-z0-9-]+"
							title="Only lowercase letters, numbers, and hyphens"
						/>
						<p class="text-muted-foreground text-xs">
							Lowercase letters, numbers, and hyphens only.
						</p>
					</div>

					<div class="grid gap-2">
						<Label for="repo-description">Description</Label>
						<Input
							id="repo-description"
							bind:value={repoSettings.description}
							placeholder="Repository description..."
						/>
					</div>
				</div>

				<!-- Privacy & Access -->
				<div class="space-y-4 border-t pt-4">
					<h3 class="text-sm font-semibold">Privacy & Access</h3>
					
					<div class="space-y-3">
						<div class="flex items-center justify-between rounded-lg border p-3">
							<div class="space-y-0.5">
								<Label for="repo-private" class="text-sm font-medium cursor-pointer">
									Private Repository
								</Label>
								<p class="text-muted-foreground text-xs">
									Only authorized users can access this repository
								</p>
							</div>
							<input
								type="checkbox"
								id="repo-private"
								bind:checked={repoSettings.isPrivate}
								class="h-4 w-4 rounded border-gray-300"
							/>
						</div>

						<div class="flex items-center justify-between rounded-lg border p-3">
							<div class="space-y-0.5">
								<Label for="repo-readonly" class="text-sm font-medium cursor-pointer">
									Read-Only
								</Label>
								<p class="text-muted-foreground text-xs">
									Lock repository to prevent all write operations
								</p>
							</div>
							<input
								type="checkbox"
								id="repo-readonly"
								bind:checked={repoSettings.isReadOnly}
								class="h-4 w-4 rounded border-gray-300"
							/>
						</div>

						<div class="flex items-center justify-between rounded-lg border p-3">
							<div class="space-y-0.5">
								<Label for="repo-template" class="text-sm font-medium cursor-pointer">
									Template Repository
								</Label>
								<p class="text-muted-foreground text-xs">
									Mark this repository as a template for creating new projects
								</p>
							</div>
							<input
								type="checkbox"
								id="repo-template"
								bind:checked={repoSettings.isTemplate}
								class="h-4 w-4 rounded border-gray-300"
							/>
						</div>
					</div>
				</div>

				<!-- Write Permissions -->
				{#if !repoSettings.isReadOnly}
					<div class="space-y-4 border-t pt-4">
						<h3 class="text-sm font-semibold">Write Permissions</h3>
						
						<div class="space-y-3">
							<div class="flex items-center justify-between rounded-lg border p-3">
								<div class="space-y-0.5">
									<Label for="repo-http-push" class="text-sm font-medium cursor-pointer">
										Allow HTTP/HTTPS Push
									</Label>
									<p class="text-muted-foreground text-xs">
										Enable push operations over HTTP/HTTPS
									</p>
								</div>
								<input
									type="checkbox"
									id="repo-http-push"
									bind:checked={repoSettings.allowHttpPush}
									class="h-4 w-4 rounded border-gray-300"
								/>
							</div>

							<div class="flex items-center justify-between rounded-lg border p-3">
								<div class="space-y-0.5">
									<Label for="repo-ssh-push" class="text-sm font-medium cursor-pointer">
										Allow SSH Push
									</Label>
									<p class="text-muted-foreground text-xs">
										Enable push operations over SSH
									</p>
								</div>
								<input
									type="checkbox"
									id="repo-ssh-push"
									bind:checked={repoSettings.allowSshPush}
									class="h-4 w-4 rounded border-gray-300"
								/>
							</div>
						</div>
					</div>
				{/if}

				<!-- SSH Keys Link -->
				<div class="border-t pt-4">
					<div class="bg-muted/30 border-border/50 rounded-lg border p-4">
						<div class="flex items-start gap-3">
							<Key class="text-muted-foreground mt-0.5 size-4 flex-shrink-0" />
							<div class="flex-1 space-y-1">
								<h4 class="text-sm font-medium">SSH Key Management</h4>
								<p class="text-muted-foreground text-xs">
									Manage your SSH keys for Git over SSH access. Add your public keys to enable SSH cloning and pushing.
								</p>
								<Button
									variant="outline"
									size="sm"
									class="mt-2"
									onclick={() => {
										goto('/profile');
										showRepoSettingsModal = false;
									}}
								>
									<Key class="mr-2 size-3" />
									Manage SSH Keys
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>

			<Dialog.Footer class="pt-6">
				<Button
					type="button"
					variant="outline"
					onclick={() => {
						showRepoSettingsModal = false;
						selectedRepo = null;
					}}
				>
					Cancel
				</Button>
				<Button
					type="button"
					disabled={isUpdatingRepo}
					onclick={async () => {
						if (!selectedRepo) return;
						
						isUpdatingRepo = true;
						try {
							const response = await updateRepositorySettingsRemote({
								repositoryId: selectedRepo.id,
								...repoSettings
							});
							
							if (!response.success) {
								throw new Error(response.message || 'Failed to update repository');
							}
							
							toastStore.success('Repository settings updated successfully');
							showRepoSettingsModal = false;
							selectedRepo = null;
							await invalidateAll();
						} catch (error: any) {
							toastStore.error(error.message || 'Failed to update repository');
						} finally {
							isUpdatingRepo = false;
						}
					}}
				>
					{isUpdatingRepo ? 'Saving...' : 'Save Changes'}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
