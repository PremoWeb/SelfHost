<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { GitBranch, GitCommit, HardDrive, Copy, Check, Lock, Unlock, Plus } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import CreateRepositoryDialog from './CreateRepositoryDialog.svelte';

	interface Repository {
		id: string;
		project_id: string;
		name: string;
		description: string | null;
		is_private: boolean;
		repository_path: string;
		default_branch: string;
		size: number;
		commit_count: number;
		branch_count: number;
		tag_count: number;
		last_commit_at: number | null;
		last_commit_message: string | null;
		last_commit_author: string | null;
		allow_http_push: boolean;
		allow_ssh_push: boolean;
		created_at: number;
		updated_at: number;
	}

	let repository: Repository | null = null;
	let loading = true;
	let showCreateDialog = false;
	let copiedUrl: string | null = null;

	const projectId = $page.params.uuid ?? '';
	const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

	$: httpCloneUrl = repository ? `${baseUrl}/api/git/${projectId}/${repository.name}.git` : '';
	$: sshCloneUrl = repository
		? `git@${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:${projectId}/${repository.name}.git`
		: '';

	onMount(async () => {
		await loadRepository();
	});

	async function loadRepository() {
		loading = true;
		try {
			const response = await fetch(`/api/git/repositories?projectId=${projectId}`);
			const data = await response.json();

			// The API returns { data: [...] }, so we need to get the first item
			if (data.data && data.data.length > 0) {
				repository = data.data[0];
			} else {
				repository = null;
			}
		} catch (error) {
			console.error('Failed to load repository:', error);
			toast.error('Failed to load repository');
		} finally {
			loading = false;
		}
	}

	function copyToClipboard(text: string, label: string) {
		navigator.clipboard.writeText(text);
		copiedUrl = text;
		toast.success(`${label} copied to clipboard`);
		setTimeout(() => {
			copiedUrl = null;
		}, 2000);
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
	}

	function formatDate(timestamp: number | null): string {
		if (!timestamp) return 'Never';
		return new Date(timestamp * 1000).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function handleRepositoryCreated() {
		showCreateDialog = false;
		loadRepository();
	}
</script>

<div class="container mx-auto max-w-5xl space-y-6 p-6">
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
		</div>
	{:else if !repository}
		<Card class="p-12 text-center">
			<GitBranch class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
			<h3 class="mb-2 text-lg font-semibold">No Git repository</h3>
			<p class="text-muted-foreground mb-6">
				This project doesn't have a Git repository yet. Create one to start version controlling your
				code.
			</p>
			<Button onclick={() => (showCreateDialog = true)}>
				<Plus class="mr-2 h-4 w-4" />
				Create Repository
			</Button>
		</Card>
	{:else}
		<div class="space-y-6">
			<!-- Repository Header -->
			<div class="flex items-start justify-between">
				<div>
					<div class="mb-2 flex items-center gap-3">
						<h1 class="text-3xl font-bold">{repository.name}</h1>
						{#if repository.is_private}
							<span class="bg-secondary flex items-center gap-1 rounded px-2 py-1 text-xs">
								<Lock class="h-3 w-3" />
								Private
							</span>
						{:else}
							<span class="bg-secondary flex items-center gap-1 rounded px-2 py-1 text-xs">
								<Unlock class="h-3 w-3" />
								Public
							</span>
						{/if}
					</div>
					{#if repository.description}
						<p class="text-muted-foreground">{repository.description}</p>
					{/if}
				</div>
			</div>

			<!-- Repository Stats -->
			<div class="grid grid-cols-1 gap-4 md:grid-cols-4">
				<Card class="p-4">
					<div class="flex items-center gap-3">
						<GitCommit class="text-muted-foreground h-5 w-5" />
						<div>
							<p class="text-2xl font-bold">{repository.commit_count}</p>
							<p class="text-muted-foreground text-sm">Commits</p>
						</div>
					</div>
				</Card>

				<Card class="p-4">
					<div class="flex items-center gap-3">
						<GitBranch class="text-muted-foreground h-5 w-5" />
						<div>
							<p class="text-2xl font-bold">{repository.branch_count}</p>
							<p class="text-muted-foreground text-sm">Branches</p>
						</div>
					</div>
				</Card>

				<Card class="p-4">
					<div class="flex items-center gap-3">
						<HardDrive class="text-muted-foreground h-5 w-5" />
						<div>
							<p class="text-2xl font-bold">{formatBytes(repository.size)}</p>
							<p class="text-muted-foreground text-sm">Size</p>
						</div>
					</div>
				</Card>

				<Card class="p-4">
					<div>
						<p class="mb-1 text-sm font-medium">Default Branch</p>
						<p class="font-mono text-lg">{repository.default_branch}</p>
					</div>
				</Card>
			</div>

			<!-- Last Commit Info -->
			{#if repository.last_commit_message}
				<Card class="p-4">
					<h3 class="mb-2 text-sm font-semibold">Latest Commit</h3>
					<p class="mb-1 text-sm">{repository.last_commit_message}</p>
					<p class="text-muted-foreground text-xs">
						by {repository.last_commit_author || 'Unknown'} • {formatDate(
							repository.last_commit_at
						)}
					</p>
				</Card>
			{/if}

			<!-- Clone URLs -->
			<Card class="p-6">
				<h3 class="mb-4 text-lg font-semibold">Clone Repository</h3>

				<div class="space-y-4">
					<div class="space-y-2">
						<Label for="http-url">HTTPS</Label>
						<div class="flex gap-2">
							<Input id="http-url" value={httpCloneUrl} readonly class="font-mono text-sm" />
							<Button
								variant="outline"
								size="icon"
								onclick={() => copyToClipboard(httpCloneUrl, 'HTTPS URL')}
							>
								{#if copiedUrl === httpCloneUrl}
									<Check class="h-4 w-4 text-green-600" />
								{:else}
									<Copy class="h-4 w-4" />
								{/if}
							</Button>
						</div>
						<p class="text-muted-foreground text-xs">
							Clone using: <code class="bg-secondary rounded px-1 py-0.5"
								>git clone {httpCloneUrl}</code
							>
						</p>
					</div>

					<div class="space-y-2">
						<Label for="ssh-url">SSH</Label>
						<div class="flex gap-2">
							<Input id="ssh-url" value={sshCloneUrl} readonly class="font-mono text-sm" />
							<Button
								variant="outline"
								size="icon"
								onclick={() => copyToClipboard(sshCloneUrl, 'SSH URL')}
							>
								{#if copiedUrl === sshCloneUrl}
									<Check class="h-4 w-4 text-green-600" />
								{:else}
									<Copy class="h-4 w-4" />
								{/if}
							</Button>
						</div>
						<p class="text-muted-foreground text-xs">
							Clone using: <code class="bg-secondary rounded px-1 py-0.5"
								>git clone {sshCloneUrl}</code
							>
						</p>
						<p class="text-muted-foreground text-xs">
							Note: SSH access requires <a
								href="/settings/ssh-keys"
								class="text-primary hover:underline">adding an SSH key</a
							>
						</p>
					</div>
				</div>
			</Card>

			<!-- Repository Settings -->
			<Card class="p-6">
				<h3 class="mb-4 text-lg font-semibold">Settings</h3>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-muted-foreground">HTTP Push</span>
						<span class="font-medium">{repository.allow_http_push ? 'Enabled' : 'Disabled'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">SSH Push</span>
						<span class="font-medium">{repository.allow_ssh_push ? 'Enabled' : 'Disabled'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Created</span>
						<span class="font-medium">{formatDate(repository.created_at)}</span>
					</div>
				</div>
			</Card>
		</div>
	{/if}
</div>

<CreateRepositoryDialog
	bind:open={showCreateDialog}
	{projectId}
	on:success={handleRepositoryCreated}
/>
