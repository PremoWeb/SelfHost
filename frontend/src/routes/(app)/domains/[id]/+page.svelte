<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { toastStore } from '$lib/stores/toast';
	import * as Card from '$lib/components/ui/card';
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Globe, Plus, Trash2, ArrowLeft, Server, Tag, ChevronRight } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	let showRecordModal = $state(false);
	let editingRecordId = $state<string | null>(null);
	let syncMode = $state<'static' | 'server' | 'tag'>('static');
	let recordType = $state('A');
	let recordName = $state('');
	let recordValue = $state('');
	let recordTtl = $state(3600);
	let recordPriority = $state<number | null>(null);
	let selectedServerId = $state('');
	let selectedTag = $state('');

	function resetForm() {
		editingRecordId = null;
		syncMode = 'static';
		recordType = 'A';
		recordName = '';
		recordValue = '';
		recordTtl = 3600;
		recordPriority = null;
		selectedServerId = '';
		selectedTag = '';
	}

	function openCreateModal() {
		resetForm();
		showRecordModal = true;
	}

	function openEditModal(record: any) {
		editingRecordId = record.id;
		syncMode = record.syncMode as 'static' | 'server' | 'tag';
		recordType = record.type;
		recordName = record.name === '@' ? '' : record.name;
		recordValue = record.value || '';
		recordTtl = record.ttl;
		recordPriority = record.priority;
		selectedServerId = record.serverId || '';
		selectedTag = record.syncTag || '';
		showRecordModal = true;
	}

	// Auto-set 2 minute TTL for tag mode for faster propagation
	$effect(() => {
		if (syncMode === 'tag') {
			recordTtl = 120;
		}
	});

	// Get resolved value for display
	function getRecordValue(record: any) {
		if (record.syncMode === 'server' && record.server) {
			const ips = [];
			if (record.type === 'A' && record.server.ip) ips.push(record.server.ip);
			if (record.type === 'AAAA' && record.server.ipv6) ips.push(record.server.ipv6);
			return ips.length > 0 ? ips.join(', ') : '—';
		} else if (record.syncMode === 'tag') {
			// Find all servers with this tag
			const taggedServers = data.servers.filter(
				(s: any) => s.tags && s.tags.includes(record.syncTag)
			);
			if (taggedServers.length === 0) return 'No matching servers found';

			const ips = [];
			for (const s of taggedServers) {
				if (record.type === 'A' && s.ip) ips.push(s.ip);
				if (record.type === 'AAAA' && s.ipv6) ips.push(s.ipv6);
			}

			return ips.length > 0 ? ips.join(', ') : '—';
		}
		return record.value || '—';
	}
</script>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button href="/domains" variant="ghost" size="icon">
			<ArrowLeft class="size-4" />
		</Button>
		<div class="flex-1">
			<div class="text-muted-foreground flex items-center gap-2 text-sm">
				<a href="/domains" class="hover:underline">Domains</a>
				<ChevronRight class="size-3" />
				<span>{data.domain.name}</span>
			</div>
			<div class="mt-1 flex items-center gap-3">
				<h1 class="text-3xl font-bold tracking-tight">{data.domain.name}</h1>
				<Badge variant="secondary" class="capitalize">{data.domain.provider}</Badge>
			</div>
		</div>
		<Button onclick={openCreateModal}>
			<Plus class="mr-2 size-4" />
			Add Record
		</Button>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>DNS Records</Card.Title>
			<Card.Description
				>Manage A, AAAA, CNAME, and other DNS records with server syncing</Card.Description
			>
		</Card.Header>
		<Card.Content>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Type</TableHead>
						<TableHead>Name</TableHead>
						<TableHead>Value / Sync</TableHead>
						<TableHead>TTL</TableHead>
						<TableHead class="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each (data as any).dnsRecords as record}
						<TableRow>
							<TableCell>
								<Badge variant="outline">{record.type}</Badge>
							</TableCell>
							<TableCell class="font-medium">
								{record.name || '@'}
							</TableCell>
							<TableCell>
								<div class="flex items-center gap-2">
									{#if record.syncMode === 'server'}
										<Badge variant="secondary" class="gap-1">
											<Server class="size-3" />
											{record.server?.name || 'Server'}
										</Badge>
										<span class="text-muted-foreground text-xs">→ {getRecordValue(record)}</span>
									{:else if record.syncMode === 'tag'}
										<Badge variant="secondary" class="gap-1">
											<Tag class="size-3" />
											{record.syncTag}
										</Badge>
										<span class="text-muted-foreground text-xs">
											→ {getRecordValue(record)} <span class="italic opacity-70">(Dynamic)</span>
										</span>
									{:else}
										<code class="text-xs">{record.value}</code>
									{/if}
								</div>
							</TableCell>
							<TableCell class="text-muted-foreground">{record.ttl}s</TableCell>
							<TableCell class="text-right">
								<div class="flex items-center justify-end gap-2">
									<Button variant="ghost" size="sm" onclick={() => openEditModal(record)}>
										Edit
									</Button>
									<form
										method="POST"
										action="?/deleteRecord"
										use:enhance={() => {
											return async ({ result }) => {
												if (result.type === 'success') {
													toastStore.success('DNS record deleted');
													await invalidateAll();
												}
											};
										}}
									>
										<input type="hidden" name="recordId" value={record.id} />
										<Button
											type="submit"
											variant="ghost"
											size="icon"
											class="text-destructive hover:text-destructive hover:bg-destructive/10"
										>
											<Trash2 class="size-4" />
										</Button>
									</form>
								</div>
							</TableCell>
						</TableRow>
					{:else}
						<TableRow>
							<TableCell colspan={5} class="h-24 text-center text-muted-foreground">
								No DNS records configured yet. Click "Add Record" to get started.
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</Card.Content>
	</Card.Root>
</div>

<Dialog.Root bind:open={showRecordModal}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{editingRecordId ? 'Edit' : 'Add'} DNS Record</Dialog.Title>
			<Dialog.Description
				>{editingRecordId ? 'Update existing' : 'Create a new'} DNS record for {data.domain
					.name}</Dialog.Description
			>
		</Dialog.Header>
		<form
			method="POST"
			action={editingRecordId ? '?/updateRecord' : '?/createRecord'}
			class="space-y-4 pt-4"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						toastStore.success(editingRecordId ? 'DNS record updated' : 'DNS record created');
						showRecordModal = false;
						resetForm();
						await invalidateAll();
					} else if (result.type === 'failure') {
						toastStore.error((result.data?.message as string) || 'Failed to save record');
					} else if (result.type === 'error') {
						toastStore.error(result.error?.message || 'An unexpected error occurred');
					}
				};
			}}
		>
			{#if editingRecordId}
				<input type="hidden" name="recordId" value={editingRecordId} />
			{/if}

			<div class="space-y-2">
				<Label>Sync Mode</Label>
				<div class="grid grid-cols-3 gap-2">
					<Button
						type="button"
						variant={syncMode === 'static' ? 'default' : 'outline'}
						size="sm"
						onclick={() => (syncMode = 'static')}
						class="w-full"
					>
						Static
					</Button>
					<Button
						type="button"
						variant={syncMode === 'server' ? 'default' : 'outline'}
						size="sm"
						onclick={() => (syncMode = 'server')}
						class="w-full gap-1"
					>
						<Server class="size-3" />
						Server
					</Button>
					<Button
						type="button"
						variant={syncMode === 'tag' ? 'default' : 'outline'}
						size="sm"
						onclick={() => (syncMode = 'tag')}
						class="w-full gap-1"
					>
						<Tag class="size-3" />
						Tag
					</Button>
				</div>
				<input type="hidden" name="syncMode" value={syncMode} />
				{#if syncMode === 'static'}
					<p class="text-muted-foreground text-xs">Manual IP address entry</p>
				{:else if syncMode === 'server'}
					<p class="text-muted-foreground text-xs">Auto-sync to a specific server's IP</p>
				{:else}
					<p class="text-muted-foreground text-xs">
						Auto-sync to all servers with a tag (DNS load balancing)
					</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="type">Record Type</Label>
				<select
					id="type"
					name="type"
					bind:value={recordType}
					class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
					required
				>
					<option value="A">A - IPv4 Address</option>
					<option value="AAAA">AAAA - IPv6 Address</option>
					<option value="CNAME">CNAME - Canonical Name</option>
					<option value="MX">MX - Mail Exchange</option>
					<option value="TXT">TXT - Text Record</option>
				</select>
			</div>

			<div class="space-y-2">
				<Label for="name">Hostname</Label>
				<Input id="name" name="name" bind:value={recordName} placeholder="www or @ for root" />
				<p class="text-muted-foreground text-xs">Leave empty or use @ for root domain</p>
			</div>

			{#if syncMode === 'static'}
				<div class="space-y-2">
					<Label for="value">Value</Label>
					<Input
						id="value"
						name="value"
						bind:value={recordValue}
						placeholder={recordType === 'A'
							? '192.0.2.1'
							: recordType === 'AAAA'
								? '2001:db8::1'
								: 'example.com'}
						required
					/>
				</div>
			{:else if syncMode === 'server'}
				<div class="space-y-2">
					<Label for="serverId">Server</Label>
					<select
						id="serverId"
						name="serverId"
						bind:value={selectedServerId}
						class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
						required
					>
						<option value="">Select a server...</option>
						{#each data.servers as server}
							<option value={server.id}>{server.name} ({server.ip})</option>
						{/each}
					</select>
				</div>
			{:else if syncMode === 'tag'}
				<div class="space-y-2">
					<Label for="tag">Server Tag</Label>
					<select
						id="tag"
						name="syncTag"
						bind:value={selectedTag}
						class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
						required
					>
						<option value="">Select a tag...</option>
						{#each data.tags as tag}
							<option value={tag}>{tag}</option>
						{/each}
					</select>
					<p class="text-muted-foreground text-xs">
						All servers with this tag will be added as DNS records
					</p>
				</div>
			{/if}

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="ttl">TTL (seconds)</Label>
					<Input id="ttl" name="ttl" type="number" bind:value={recordTtl} placeholder="3600" />
					{#if syncMode === 'tag'}
						<p class="text-xs text-yellow-600 dark:text-yellow-500">
							Set to 120s for faster propagation when adding/removing servers.
						</p>
					{/if}
				</div>
				{#if recordType === 'MX'}
					<div class="space-y-2">
						<Label for="priority">Priority</Label>
						<Input
							id="priority"
							name="priority"
							type="number"
							bind:value={recordPriority}
							placeholder="10"
						/>
					</div>
				{/if}
			</div>

			<Dialog.Footer>
				<Button type="submit" class="w-full">{editingRecordId ? 'Update' : 'Create'} Record</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
