<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import { formatDate } from '$lib/utils/helpers';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import StickyHeader from '$lib/components/StickyHeader.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Database, Plus, Globe, Package, Info, ExternalLink } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showCreateModal = $state(false);
	let name = $state('');
	let description = $state('');
	let endpoint = $state('https://s3.amazonaws.com');
	let region = $state('us-east-1');
	let bucket = $state('');
	let accessKey = $state('');
	let secretKey = $state('');
	let isCreating = $state(false);

	async function handleCreate() {
		if (!name || !endpoint || !bucket || !accessKey || !secretKey) {
			toastStore.error('All fields are required');
			return;
		}

		isCreating = true;
		try {
			await api.post('/storages', {
				name,
				description,
				endpoint,
				region,
				bucket,
				accessKey,
				secretKey
			});
			toastStore.success('S3 storage created successfully');
			showCreateModal = false;
			name = '';
			description = '';
			endpoint = 'https://s3.amazonaws.com';
			region = 'us-east-1';
			bucket = '';
			accessKey = '';
			secretKey = '';
			await invalidateAll();
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to create S3 storage');
		} finally {
			isCreating = false;
		}
	}
</script>

<PageTitle title="S3 Storages" />

<div class="space-y-6">
	<StickyHeader>
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">S3 Storages</h1>
				<p class="text-muted-foreground mt-1">
					Manage S3-compatible storage for backups and persistent data.
				</p>
			</div>
			<Button onclick={() => (showCreateModal = true)}>
				<Plus class="mr-2 size-4" />
				Add S3 Storage
			</Button>
		</div>
	</StickyHeader>

	{#if data.storages.length === 0}
		<div
			class="bg-muted/30 border-border/50 flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center"
		>
			<div class="bg-muted/30 border-border/50 mb-4 flex size-12 items-center justify-center rounded-full border">
				<Database class="text-muted-foreground size-6" />
			</div>
			<h3 class="text-lg font-semibold">No S3 storages</h3>
			<p class="text-muted-foreground mt-1 max-w-sm text-sm">
				You haven't added any S3-compatible storage yet. Get started by connecting your first
				provider.
			</p>
			<div class="mt-6">
				<Button onclick={() => (showCreateModal = true)}>
					<Plus class="mr-2 size-4" />
					Add S3 Storage
				</Button>
			</div>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.storages as storage}
				<Card.Root class="group relative overflow-hidden transition-all hover:shadow-md">
					<Card.Header>
						<div class="flex items-start justify-between">
							<div class="flex items-center gap-3 flex-1 min-w-0">
								<div class="bg-muted rounded-lg p-2 flex-shrink-0">
									<Database class="size-5" />
								</div>
								<div class="space-y-1 min-w-0 flex-1">
									<Card.Title class="text-base truncate">{storage?.name}</Card.Title>
									<div class="flex items-center gap-1.5">
										<Badge variant="secondary" class="text-xs font-mono uppercase">S3</Badge>
									</div>
								</div>
							</div>
						</div>
					</Card.Header>
					<Card.Content>
						{#if storage.description}
							<p class="text-muted-foreground mb-4 line-clamp-2 text-sm">
								{storage.description}
							</p>
						{/if}
						<div class="space-y-3">
							<div class="flex items-center gap-2 text-sm">
								<Globe class="text-muted-foreground size-4" />
								<span class="text-muted-foreground font-medium">Endpoint:</span>
								<span class="truncate font-mono text-xs">{storage?.endpoint}</span>
							</div>
							<div class="flex items-center gap-2 text-sm">
								<Package class="text-muted-foreground size-4" />
								<span class="text-muted-foreground font-medium">Bucket:</span>
								<span class="truncate font-mono text-xs">{storage?.bucket}</span>
							</div>
						</div>
					</Card.Content>
					<Card.Footer class="bg-muted/30 border-t">
						<div class="text-muted-foreground flex w-full items-center justify-between text-xs">
							<span class="flex items-center gap-1.5">
								<Info class="size-3.5" />
								Created {storage?.createdAt ? formatDate(storage.createdAt.toString()) : 'N/A'}
							</span>
							<ExternalLink class="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
						</div>
					</Card.Footer>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>

<!-- Create S3 Storage Modal -->
<Dialog.Root bind:open={showCreateModal}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Add S3 Storage</Dialog.Title>
			<Dialog.Description>
				Connect an S3-compatible storage provider (AWS, Vultr, MinIO, DigitalOcean Spaces, etc.)
			</Dialog.Description>
		</Dialog.Header>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleCreate();
			}}
			class="space-y-4"
		>
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="name">Name</Label>
					<Input
						id="name"
						name="name"
						bind:value={name}
						placeholder="My Backups S3"
						required
					/>
				</div>
				<div class="space-y-2">
					<Label for="region">Region</Label>
					<Input
						id="region"
						name="region"
						bind:value={region}
						placeholder="us-east-1"
						required
					/>
				</div>
			</div>

			<div class="space-y-2">
				<Label for="description">Description</Label>
				<Input
					id="description"
					name="description"
					bind:value={description}
					placeholder="Main storage for production backups"
				/>
			</div>

			<div class="space-y-2">
				<Label for="endpoint">Endpoint</Label>
				<Input
					id="endpoint"
					name="endpoint"
					bind:value={endpoint}
					placeholder="https://s3.amazonaws.com"
					required
				/>
			</div>

			<div class="space-y-2">
				<Label for="bucket">Bucket</Label>
				<Input
					id="bucket"
					name="bucket"
					bind:value={bucket}
					placeholder="my-app-backups"
					required
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="accessKey">Access Key</Label>
					<Input
						id="accessKey"
						name="accessKey"
						bind:value={accessKey}
						placeholder="AKIA..."
						required
					/>
				</div>
				<div class="space-y-2">
					<Label for="secretKey">Secret Key</Label>
					<Input
						id="secretKey"
						name="secretKey"
						type="password"
						bind:value={secretKey}
						placeholder="••••••••••••"
						required
					/>
				</div>
			</div>

			<Dialog.Footer>
				<Button variant="outline" onclick={() => (showCreateModal = false)}>
					Cancel
				</Button>
				<Button type="submit" disabled={isCreating}>
					{#if isCreating}
						Creating...
					{:else}
						<Database class="mr-2 size-4" />
						Connect Storage
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
