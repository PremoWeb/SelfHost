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
	import PageTitle from '$lib/components/PageTitle.svelte';
	import StickyHeader from '$lib/components/StickyHeader.svelte';
	import {
		Search,
		Plus,
		Globe,
		Trash2,
		CloudDownload,
		Cloud,
		Settings,
		Users,
		Share2,
		UserPlus
	} from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	let showAddModal = $state(false);
	let showManageModal = $state(false);
	let showCreateOnVultrModal = $state(false);
	let newDomainName = $state('');
	let newDomainProvider = $state('custom');
	let selectedProfileId = $state('');
	let newVultrDomainName = $state('');
	let newVultrDomainIp = $state('');

	let selectedDomainToManage = $state<{ name: string; provider: string } | null>(null);

	let searchQuery = $state('');

	// Unified domains list (Vultr + Custom)
	let allDomains = $derived(
		(() => {
			const vultr = (data.vultrDomains || []).map((vd) => {
				const local = (data.domains || []).find(
					(d) => d.name.toLowerCase() === vd.domain.toLowerCase()
				);
				return {
					...vd,
					name: vd.domain,
					provider: 'vultr',
					localDomain: local,
					isManaged: !!local
				};
			});

			// Filter out local domains that are already covered by Vultr list to avoid duplicates
			// OR include them if you want custom domains separate
			// Actually, manual domains that are NOT Vultr should be added
			const localOnly = (data.domains || []).filter(
				(d) => d.provider !== 'vultr' // Vultr ones are handled above (sort of, unless local exists but remote doesn't?)
				// If local exists but remote doesn't (cache offset), it should appear.
				// But for now, let's trust the 'provider' field.
			);

			// Actually, a cleaner way:
			// 1. Map all local domains
			// 2. Map all remote domains
			// 3. Merge by name

			const domainMap = new Map();

			// Add all local domains first
			data.domains?.forEach((d) => {
				domainMap.set(d.name.toLowerCase(), {
					...d,
					id: d.id, // Ensure ID is top level
					isManaged: true, // It's in our DB
					provider: d.provider // keep original provider
				});
			});

			// Add/Merge Vultr domains
			data.vultrDomains?.forEach((vd) => {
				const lowerName = vd.domain.toLowerCase();
				const existing = domainMap.get(lowerName);
				if (existing) {
					// Update existing with remote info if needed, but keep local ID
					domainMap.set(lowerName, {
						...existing,
						...vd,
						provider: 'vultr',
						localDomain: existing
					});
				} else {
					// New remote domain not in DB
					domainMap.set(lowerName, {
						...vd,
						name: vd.domain,
						provider: 'vultr',
						isManaged: false
					});
				}
			});

			return Array.from(domainMap.values())
				.filter((d) => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
				.sort((a, b) => a.name.localeCompare(b.name));
		})()
	);

	function openManageModal(domain: string, provider: string) {
		selectedDomainToManage = { name: domain, provider };
		selectedProfileId = '';
		showManageModal = true;
	}

	let showShareModal = $state(false);
	let selectedDomainForSharing = $state<any>(null);
	let showOwnerModal = $state(false);
	let selectedDomainForOwner = $state<any>(null);

	function getEntityName(type: string, id: string | null) {
		if (!id) return 'Unassigned';
		if (type === 'individual' || type === 'user') {
			return data.allUsers.find((u) => u.id === id)?.name || 'Unknown User';
		}
		if (type === 'team') {
			return data.allTeams.find((t) => t.id === id)?.name || 'Unknown Team';
		}
		if (type === 'company') {
			return data.allCompanies.find((c) => c.id === id)?.name || 'Unknown Company';
		}
		if (!type && id) {
			// Fallback check if type is missing but ID exists (legacy teamId)
			return data.allTeams.find((t) => t.id === id)?.name || 'Unknown Owner';
		}
		return 'Unassigned';
	}

	function openShareModal(domain: any) {
		selectedDomainForSharing = domain;
		showShareModal = true;
	}

	function openOwnerModal(domain: any) {
		selectedDomainForOwner = domain;
		showOwnerModal = true;
	}
</script>

<PageTitle title="Domains" />

<div class="space-y-10">
	<StickyHeader class="space-y-4">
		<div class="flex items-center justify-between">
			<div class="flex flex-col gap-1">
				<h1 class="text-3xl font-bold tracking-tight">Domains</h1>
				<p class="text-muted-foreground">Manage DNS and global traffic for your infrastructure.</p>
			</div>
			<div class="flex items-center gap-2">
				{#if data.vultrProvider}
					<Button
						variant="outline"
						onclick={() => {
							showCreateOnVultrModal = true;
							newVultrDomainName = '';
							newVultrDomainIp = '';
						}}
					>
						<Cloud class="mr-2 size-4" />
						Create on Vultr
					</Button>
				{/if}
				<Button
					onclick={() => {
						showAddModal = true;
						selectedProfileId = '';
						newDomainName = '';
						newDomainProvider = 'custom';
					}}
				>
					<Plus class="mr-2 size-4" />
					Connect Domain
				</Button>
			</div>
		</div>

		<div class="relative">
			<Search class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
			<Input bind:value={searchQuery} placeholder="Search domains..." class="h-11 pl-10" />
		</div>
	</StickyHeader>

	<!-- Unified Unified Domain List -->
	<Card.Root>
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead class="w-[30%]">Domain</TableHead>
					<TableHead>Source</TableHead>
					<TableHead>Owner</TableHead>
					<TableHead>Status</TableHead>
					<TableHead>Profile</TableHead>
					<TableHead>Shares</TableHead>
					<TableHead class="text-right">Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#each allDomains as domain}
					<TableRow>
						<TableCell class="font-medium">
							<div class="flex items-center gap-2">
								<Globe class="text-muted-foreground size-4" />
								{domain.name || domain.domain}
							</div>
						</TableCell>
						<TableCell>
							<Badge variant="secondary" class="capitalize">
								{domain.provider || 'vultr'}
							</Badge>
						</TableCell>
						<TableCell>
							<button
								onclick={() => openOwnerModal(domain)}
								class="hover:bg-muted group flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors"
							>
								<Users class="text-muted-foreground group-hover:text-foreground size-3.5" />
								<span
									>{getEntityName(
										domain.ownerType || 'team',
										domain.ownerId || domain.teamId
									)}</span
								>
							</button>
						</TableCell>
						<TableCell>
							{#if domain.isManaged || domain.id}
								<Badge variant="default" class="bg-green-600 hover:bg-green-700">Managed</Badge>
							{:else}
								<Badge variant="secondary">Unmanaged</Badge>
							{/if}
						</TableCell>
						<TableCell>
							{#if domain.localDomain?.nameserverProfile || domain.nameserverProfile}
								<span class="text-muted-foreground text-sm"
									>{domain.localDomain?.nameserverProfile?.name ||
										domain.nameserverProfile?.name}</span
								>
							{:else if domain.isManaged || domain.id}
								<span class="text-muted-foreground text-sm italic">None</span>
							{:else}
								<span class="text-muted-foreground text-sm opacity-50">—</span>
							{/if}
						</TableCell>
						<TableCell>
							{#if domain.shares?.length > 0}
								<button
									onclick={() => openShareModal(domain)}
									class="text-primary text-xs hover:underline"
								>
									{domain.shares.length} share{domain.shares.length > 1 ? 's' : ''}
								</button>
							{:else if domain.id || domain.localDomain?.id}
								<Button
									variant="ghost"
									size="sm"
									class="h-8 px-2"
									onclick={() => openShareModal(domain)}
								>
									<Share2 class="size-3.5" />
								</Button>
							{:else}
								<span class="text-muted-foreground/50 text-xs">—</span>
							{/if}
						</TableCell>

						<TableCell class="text-right">
							<div class="flex items-center justify-end gap-2">
								{#if domain.isManaged || domain.id}
									<Button
										href="/domains/{domain.localDomain?.id || domain.id}"
										variant="outline"
										size="sm"
									>
										<Settings class="mr-2 size-4" />
										Manage DNS
									</Button>
									<form method="POST" action="?/delete" use:enhance>
										<input type="hidden" name="id" value={domain.localDomain?.id || domain.id} />
										<Button
											type="submit"
											variant="ghost"
											size="sm"
											class="text-destructive hover:text-destructive hover:bg-destructive/10"
										>
											<Trash2 class="size-4" />
										</Button>
									</form>
								{:else}
									<Button
										variant="outline"
										size="sm"
										onclick={() => openManageModal(domain.domain, 'vultr')}
									>
										Start Managing
									</Button>
								{/if}
							</div>
						</TableCell>
					</TableRow>
				{:else}
					<TableRow>
						<TableCell colspan={5} class="h-24 text-center text-muted-foreground">
							No domains found.
						</TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	</Card.Root>
</div>

<!-- Register Domain Modal -->
<Dialog.Root bind:open={showAddModal}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Connect Domain</Dialog.Title>
			<Dialog.Description>Add a new root domain to manage locally.</Dialog.Description>
			<div class="bg-muted/50 text-muted-foreground rounded-md border p-3 text-left text-sm">
				<p class="font-semibold">Note regarding domain registration</p>
				<p class="mt-1 text-xs">
					This does not register a new domain with a registrar. Use this to connect an existing
					domain you already own. If you manage domains via a Cloud Provider (e.g. Vultr), setup the
					provider in Cloud Providers first.
				</p>
			</div>
		</Dialog.Header>

		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						showAddModal = false;
						newDomainName = '';
						selectedProfileId = '';
						toastStore.success('Domain registered');
						await invalidateAll();
					}
				};
			}}
			class="space-y-4 pt-4"
			autocomplete="off"
		>
			<div class="space-y-2">
				<Label for="name">Domain Name</Label>
				<Input
					id="name"
					name="name"
					bind:value={newDomainName}
					placeholder="example.com"
					required
				/>
			</div>
			<div class="space-y-2">
				<Label for="provider">DNS Provider</Label>
				<select
					id="provider"
					name="provider"
					bind:value={newDomainProvider}
					class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
				>
					<option value="custom">Manual</option>
					<option value="vultr">Vultr</option>
					<option value="cloudflare">Cloudflare</option>
				</select>
			</div>
			<div class="space-y-2">
				<Label for="profile">Nameserver Profile (Optional)</Label>
				<select
					id="profile"
					name="nameserverProfileId"
					bind:value={selectedProfileId}
					class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
				>
					<option value="">None (Use Default)</option>
					{#each data.nameserverProfiles as profile}
						<option value={profile.id}>{profile.name}</option>
					{/each}
				</select>
			</div>
			<Dialog.Footer>
				<Button type="submit" class="w-full">Connect Domain</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Start Managing Modal -->
<Dialog.Root bind:open={showManageModal}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Start Managing Domain</Dialog.Title>
			<Dialog.Description>
				Configure management settings for <span class="font-semibold"
					>{selectedDomainToManage?.name}</span
				>
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						showManageModal = false;
						toastStore.success(`${selectedDomainToManage?.name} is now managed`);
						await invalidateAll();
					}
				};
			}}
			class="space-y-4 pt-4"
			autocomplete="off"
		>
			<input type="hidden" name="name" value={selectedDomainToManage?.name} />
			<input type="hidden" name="provider" value={selectedDomainToManage?.provider} />

			<div class="space-y-2">
				<Label for="manageProfile">Nameserver Profile (Optional)</Label>
				<select
					id="manageProfile"
					name="nameserverProfileId"
					bind:value={selectedProfileId}
					class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
				>
					<option value="">None (Use Default)</option>
					{#each data.nameserverProfiles as profile}
						<option value={profile.id}>{profile.name}</option>
					{/each}
				</select>
				<p class="text-muted-foreground text-[0.8rem]">
					Select which nameservers this domain should use.
				</p>
			</div>

			<Dialog.Footer>
				<Button type="submit" class="w-full">Start Managing</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Create on Vultr Modal -->
<Dialog.Root bind:open={showCreateOnVultrModal}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Create Domain on Vultr</Dialog.Title>
			<Dialog.Description
				>Create a new domain directly on your Vultr account and import it into Premo.</Dialog.Description
			>
		</Dialog.Header>
		<form
			method="POST"
			action="?/createOnProvider"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						showCreateOnVultrModal = false;
						newVultrDomainName = '';
						newVultrDomainIp = '';
						toastStore.success('Domain created on Vultr and imported');
						await invalidateAll();
					} else if (result.type === 'failure') {
						toastStore.error(String(result.data?.error) || 'Failed to create domain');
					}
				};
			}}
			class="space-y-4 pt-4"
			autocomplete="off"
		>
			<div class="space-y-2">
				<Label for="vultr-name">Domain Name</Label>
				<Input
					id="vultr-name"
					name="name"
					bind:value={newVultrDomainName}
					placeholder="example.com"
					required
				/>
				<p class="text-muted-foreground text-xs">The root domain to create (e.g., example.com)</p>
			</div>
			<div class="space-y-2">
				<Label for="vultr-ip">Initial IP Address (Optional)</Label>
				<Input id="vultr-ip" name="ip" bind:value={newVultrDomainIp} placeholder="1.2.3.4" />
				<p class="text-muted-foreground text-xs">
					Optional: Create an initial A record pointing to this IP
				</p>
			</div>
			<Dialog.Footer>
				<Button type="submit" class="w-full">Create on Vultr</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Share Domain Modal -->
<Dialog.Root bind:open={showShareModal}>
	<Dialog.Content class="max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Share Domain</Dialog.Title>
			<Dialog.Description>
				Manage access for <span class="font-semibold">{selectedDomainForSharing?.name}</span>.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-6 pt-4">
			{#if selectedDomainForSharing?.shares?.length > 0}
				<div class="space-y-3">
					<h4 class="text-sm font-medium">Currently Shared With</h4>
					<div class="space-y-2">
						{#each selectedDomainForSharing.shares as share}
							<div class="bg-muted/50 flex items-center justify-between rounded-lg border p-3">
								<div class="flex items-center gap-3">
									<div class="bg-background rounded-full border p-2">
										{#if share.assigneeType === 'user'}
											<Users class="size-4" />
										{:else if share.assigneeType === 'team'}
											<Users class="size-4" />
										{:else}
											<Globe class="size-4" />
										{/if}
									</div>
									<div class="flex flex-col">
										<span class="text-sm font-medium"
											>{getEntityName(share.assigneeType, share.assigneeId)}</span
										>
										<span class="text-muted-foreground text-xs capitalize"
											>{share.assigneeType} • {share.role}</span
										>
									</div>
								</div>
								<form
									method="POST"
									action="?/updateShares"
									use:enhance={() => {
										return async ({ result }) => {
											if (result.type === 'success') {
												toastStore.success('Share removed');
												await invalidateAll();
											}
										};
									}}
								>
									<input
										type="hidden"
										name="domainId"
										value={selectedDomainForSharing.id || selectedDomainForSharing.localDomain?.id}
									/>
									<input
										type="hidden"
										name="shares"
										value={JSON.stringify(
											selectedDomainForSharing.shares.filter((s) => s.id !== share.id)
										)}
									/>
									<Button
										type="submit"
										variant="ghost"
										size="sm"
										class="text-destructive h-8 w-8 p-0"
									>
										<Trash2 class="size-4" />
									</Button>
								</form>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="space-y-4">
				<h4 class="text-sm font-medium">Add New Share</h4>
				<form
					method="POST"
					action="?/updateShares"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								toastStore.success('Domain shared');
								await invalidateAll();
							}
						};
					}}
					class="grid grid-cols-12 items-end gap-3"
				>
					<input
						type="hidden"
						name="domainId"
						value={selectedDomainForSharing?.id || selectedDomainForSharing?.localDomain?.id}
					/>
					<input
						type="hidden"
						name="shares"
						value={(() => {
							// We'll use a temporary state for the form, but for simplicity here
							// we'll just handle one add at a time.
							// In a real app we might have a list of new shares.
							return '[]';
						})()}
					/>

					<!-- Simplified ADD logic using a reactive form state would be better, but let's use separate selects for now -->
					<div class="col-span-4 space-y-1.5">
						<Label>Type</Label>
						<select
							id="new-share-type"
							class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
							onchange={(e) => {
								const type = e.currentTarget.value;
								const select = document.getElementById('new-share-id') as HTMLSelectElement;
								select.innerHTML = '';
								if (type === 'user') {
									data.allUsers.forEach((u) => select.add(new Option(u.name, u.id)));
								} else if (type === 'team') {
									data.allTeams.forEach((t) => select.add(new Option(t.name, t.id)));
								} else if (type === 'company') {
									data.allCompanies.forEach((c) => select.add(new Option(c.name, c.id)));
								}
							}}
						>
							<option value="team">Team</option>
							<option value="user">Individual</option>
							<option value="company">Company</option>
						</select>
					</div>
					<div class="col-span-5 space-y-1.5">
						<Label>Assignee</Label>
						<!-- This would be better as its own state too, but let's try to make it work -->
						<select
							id="new-share-id"
							class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
						>
							{#each data.allTeams as team}
								<option value={team.id}>{team.name}</option>
							{/each}
						</select>
					</div>
					<div class="col-span-3">
						<Button
							type="button"
							class="w-full"
							onclick={(e) => {
								const type = (document.getElementById('new-share-type') as HTMLSelectElement).value;
								const id = (document.getElementById('new-share-id') as HTMLSelectElement).value;
								if (!id) return;

								const currentShares = selectedDomainForSharing.shares || [];
								const newShares = [
									...currentShares,
									{ assigneeType: type, assigneeId: id, role: 'use' }
								];

								// Manually trigger the form submission since we prepared the JSON
								const form = e.currentTarget.closest('form');
								if (form) {
									form.querySelector('input[name="shares"]').value = JSON.stringify(newShares);
									form.requestSubmit();
								}
							}}
						>
							<Plus class="mr-1 size-4" /> Share
						</Button>
					</div>
				</form>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Update Owner Modal -->
<Dialog.Root bind:open={showOwnerModal}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Change Owner</Dialog.Title>
			<Dialog.Description>
				Set the primary owner for <span class="font-semibold">{selectedDomainForOwner?.name}</span>.
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="?/updateOwner"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						showOwnerModal = false;
						toastStore.success('Owner updated');
						await invalidateAll();
					}
				};
			}}
			class="space-y-4 pt-4"
		>
			<input
				type="hidden"
				name="domainId"
				value={selectedDomainForOwner?.id || selectedDomainForOwner?.localDomain?.id}
			/>

			<div class="space-y-2">
				<Label for="ownerType">Owner Type</Label>
				<select
					name="ownerType"
					id="ownerType"
					class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
					onchange={(e) => {
						// Simple way to refresh the assignee list based on type
						const type = e.currentTarget.value;
						const select = document.getElementById('ownerId') as HTMLSelectElement;
						select.innerHTML = '';
						if (type === 'individual') {
							data.allUsers.forEach((u) => select.add(new Option(u.name, u.id)));
						} else if (type === 'team') {
							data.allTeams.forEach((t) => select.add(new Option(t.name, t.id)));
						} else if (type === 'company') {
							data.allCompanies.forEach((c) => select.add(new Option(c.name, c.id)));
						}
					}}
				>
					<option value="team">Team</option>
					<option value="individual">Individual</option>
					<option value="company">Company</option>
				</select>
			</div>

			<div class="space-y-2">
				<Label for="ownerId">Select Owner</Label>
				<select
					name="ownerId"
					id="ownerId"
					class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
				>
					{#each data.allTeams as team}
						<option
							value={team.id}
							selected={team.id ===
								(selectedDomainForOwner?.ownerId || selectedDomainForOwner?.teamId)}
							>{team.name}</option
						>
					{/each}
				</select>
			</div>

			<Dialog.Footer>
				<Button type="submit" class="w-full">Update Owner</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
