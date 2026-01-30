<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import StickyHeader from '$lib/components/StickyHeader.svelte';
	import { Github, Gitlab, GitBranch, Search, ExternalLink, RefreshCw } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let repositories = $state<any[]>([]);
	let filteredRepositories = $state<any[]>([]);
	let isLoading = $state(false);
	let searchQuery = $state('');
	let needsInstallation = $state(false);

	onMount(async () => {
		await loadRepositories();
	});

	async function loadRepositories() {
		isLoading = true;
		needsInstallation = false;

		try {
			// First, ensure we have installation ID for GitHub Apps
			if (data.source.isApp && !data.source.installationId) {
				await api.post(`/sources/${data.source.id}/installations`, {});
			}

			const response = await api.get<{ repositories: any[] }>(
				`/sources/${data.source.id}/repositories`
			);
			repositories = response.data.repositories || [];
			filteredRepositories = repositories;
		} catch (error: any) {

			if (error.response?.status === 400 && data.source.isApp) {
				needsInstallation = true;
				toastStore.error('Please install the GitHub App on at least one repository');
			} else {
				toastStore.error('Failed to load repositories');
			}
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if (searchQuery.trim()) {
			filteredRepositories = repositories.filter(
				(repo) =>
					repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
			);
		} else {
			filteredRepositories = repositories;
		}
	});

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

	let Icon = $derived(getIcon(data.source.type));
</script>

<PageTitle title={data.source.name} />

<div class="space-y-6">
	<StickyHeader class="space-y-4">
		<div class="flex items-start justify-between">
			<div class="flex items-center gap-4">
				<div class="bg-muted rounded-lg p-3">
					<Icon class="size-6" />
				</div>
				<div>
					<h1 class="text-3xl font-bold tracking-tight">{data.source.name}</h1>
					<p class="text-muted-foreground mt-1">
						{#if data.source.description}
							{data.source.description}
						{:else}
							{data.source.type} source
						{/if}
					</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<Badge variant={data.source.isApp ? 'default' : 'outline'} class="capitalize">
					{data.source.isApp ? 'GitHub App' : 'Access Token'}
				</Badge>
				<Button variant="outline" size="sm" onclick={loadRepositories} disabled={isLoading}>
					<RefreshCw class="mr-2 size-4 {isLoading ? 'animate-spin' : ''}" />
					Refresh
				</Button>
			</div>
		</div>

		<!-- Search -->
		<div class="relative">
			<Search class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
			<Input
				type="search"
				placeholder="Search repositories..."
				bind:value={searchQuery}
				class="pl-10"
				autofocus
			/>
		</div>
	</StickyHeader>

	<!-- Repositories -->
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="text-center">
				<RefreshCw class="text-muted-foreground mx-auto mb-2 size-8 animate-spin" />
				<p class="text-muted-foreground">Loading repositories...</p>
			</div>
		</div>
	{:else if needsInstallation}
		<Card.Root class="border-dashed">
			<Card.Content class="flex flex-col items-center justify-center py-12 text-center">
				<div class="bg-muted/50 mb-4 rounded-full p-4">
					<Github class="text-muted-foreground size-8" />
				</div>
				<h3 class="text-lg font-semibold">No repositories accessible</h3>
				<p class="text-muted-foreground mt-1 mb-6 max-w-md text-sm">
					This GitHub App hasn't been installed on any repositories yet. Install it on your
					repositories to grant access.
				</p>
				<Button href={data.source.htmlUrl} target="_blank">
					<ExternalLink class="mr-2 size-4" />
					Configure GitHub App
				</Button>
			</Card.Content>
		</Card.Root>
	{:else if filteredRepositories.length === 0}
		<Card.Root class="border-dashed">
			<Card.Content class="flex flex-col items-center justify-center py-12 text-center">
				<div class="bg-muted/50 mb-4 rounded-full p-4">
					<Search class="text-muted-foreground size-8" />
				</div>
				<h3 class="text-lg font-semibold">
					{searchQuery ? 'No repositories found' : 'No repositories'}
				</h3>
				<p class="text-muted-foreground mt-1 max-w-sm text-sm">
					{searchQuery
						? 'Try adjusting your search query'
						: 'No repositories are accessible from this source'}
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each filteredRepositories as repo}
				<Card.Root class="group transition-all hover:shadow-md">
					<Card.Header>
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0 flex-1">
								<Card.Title class="truncate text-base">{repo.name}</Card.Title>
								<p class="text-muted-foreground mt-1 truncate text-xs">{repo.full_name}</p>
							</div>
							{#if repo.private}
								<Badge variant="outline" class="shrink-0">Private</Badge>
							{/if}
						</div>
					</Card.Header>
					<Card.Content>
						{#if repo.description}
							<p class="text-muted-foreground mb-4 line-clamp-2 text-sm">
								{repo.description}
							</p>
						{/if}
						<div class="flex items-center justify-between">
							<Badge variant="secondary" class="text-xs">
								{repo.default_branch}
							</Badge>
							<Button variant="ghost" size="sm" href={repo.html_url} target="_blank">
								<ExternalLink class="size-3" />
							</Button>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>

		<div class="text-muted-foreground text-center text-sm">
			Showing {filteredRepositories.length} of {repositories.length} repositories
		</div>
	{/if}
</div>
