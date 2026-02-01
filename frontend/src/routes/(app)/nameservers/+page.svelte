<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import { toastStore } from '$lib/stores/toast';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Trash2, Star, Plus, Globe, Share2 } from 'lucide-svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';

	let { data }: { data: PageData } = $props();

	let showAddModal = $state(false);
	let showShareModal = $state(false);
	let selectedProfileId = $state('');
	let shareAssigneeId = $state('');
	let shareAssigneeType = $state('user'); // user, team, company
	let shareRole = $state('use'); // use, manage

	let newName = $state('');
	let ns1 = $state('');
	let ns2 = $state('');
	let ns3 = $state('');
	let ns4 = $state('');
	let dnsProviderId = $state('');

	function openShareModal(profileId: string) {
		selectedProfileId = profileId;
		showShareModal = true;
	}
</script>

<PageTitle title="Nameserver Profiles" />
<div class="space-y-6">
	<div class="flex items-center justify-between border-b pb-6">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-bold tracking-tight">Nameserver Profiles</h1>
			<p class="text-muted-foreground">Standardize DNS management across your infrastructure.</p>
		</div>
		<Button onclick={() => (showAddModal = true)}>
			<Plus class="mr-2 size-4" />
			Create Profile
		</Button>
	</div>

	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each data.profiles || [] as profile}
			{@const isDefault = data.defaultProfileId === profile.id}
			<Card.Root>
				<Card.Header>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Globe class="text-muted-foreground size-4" />
							<Card.Title class="text-lg">{profile.name}</Card.Title>
						</div>
						<div class="flex gap-2">
							{#if isDefault}
								<Badge variant="default">Default</Badge>
							{/if}
							<Badge variant="secondary">
								{profile.dnsProvider ? `API: ${profile.dnsProvider.name}` : 'Manual'}
							</Badge>
						</div>
					</div>
				</Card.Header>
				<Card.Content class="space-y-1">
					<div
						class="text-muted-foreground bg-muted flex flex-col gap-0.5 rounded p-2 font-mono text-xs"
					>
						<div class="flex justify-between">
							<span class="opacity-50">NS1</span>
							<span>{profile.ns1}</span>
						</div>
						{#if profile.ns2}<div class="flex justify-between">
								<span class="opacity-50">NS2</span><span>{profile.ns2}</span>
							</div>{/if}
						{#if profile.ns3}<div class="flex justify-between">
								<span class="opacity-50">NS3</span><span>{profile.ns3}</span>
							</div>{/if}
						{#if profile.ns4}<div class="flex justify-between">
								<span class="opacity-50">NS4</span><span>{profile.ns4}</span>
							</div>{/if}
					</div>
				</Card.Content>
				<Card.Footer class="justify-end gap-2 border-t pt-4">
					<Button
						size="sm"
						variant="ghost"
						title="Share Profile"
						onclick={() => openShareModal(profile.id)}
					>
						<Share2 class="size-4" />
					</Button>
					{#if !isDefault}
						<form method="POST" action="?/setDefault" use:enhance>
							<input type="hidden" name="profileId" value={profile.id} />
							<Button size="sm" variant="outline" type="submit" title="Set as default">
								<Star class="size-4" />
							</Button>
						</form>
					{/if}
					<form method="POST" action="?/delete" use:enhance>
						<input type="hidden" name="id" value={profile.id} />
						<Button
							size="sm"
							variant="ghost"
							type="submit"
							class="text-destructive hover:text-destructive hover:bg-destructive/10"
						>
							<Trash2 class="size-4" />
						</Button>
					</form>
				</Card.Footer>
			</Card.Root>
		{:else}
			<div class="md:col-span-full py-20 text-center border-2 border-dashed rounded-lg bg-muted/30">
				<p class="text-muted-foreground">No nameserver profiles found.</p>
			</div>
		{/each}
	</div>

	<div class="bg-card text-card-foreground mt-8 rounded-lg border p-6 shadow-sm">
		<div class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
			<div class="space-y-1">
				<h3 class="text-xl leading-none font-semibold tracking-tight">Vanity Nameservers</h3>
				<p class="text-muted-foreground max-w-2xl text-sm">
					You can use a DNS Provider that supports white-label DNS (e.g., <a
						href="https://www.vultr.com/docs/how-to-create-vanity-name-servers/"
						target="_blank"
						class="hover:text-primary underline">Vultr</a
					>) for a branded experience. It is recommended to connect a DNS API provider to manage
					zone records directly, enabling both manual and automatic updates.
				</p>
			</div>
			<div class="flex shrink-0">
				<Button variant="outline" href="/docs/vanity-dns" target="_blank">
					<Globe class="mr-2 size-4" />
					Read Documentation
				</Button>
			</div>
		</div>
	</div>
</div>

<Dialog.Root bind:open={showAddModal}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Create Profile</Dialog.Title>
			<Dialog.Description>
				Define default nameservers for domain registration. RFC 1035 requires a minimum of <a
					href="https://datatracker.ietf.org/doc/html/rfc1035#section-2.3.1"
					target="_blank"
					class="text-primary hover:underline">2 nameservers</a
				>. Learn how to set up
				<a href="/docs/vanity-dns" target="_blank" class="text-primary hover:underline"
					>Vanity DNS & Glue Records</a
				>.
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						showAddModal = false;
						newName = '';
						ns1 = '';
						ns2 = '';
						ns3 = '';
						ns4 = '';
						toastStore.success('Profile created');
						await update();
					} else if (result.type === 'failure') {
						toastStore.error(
							result.data?.message || result.data?.error || 'Failed to create profile'
						);
					} else {
						toastStore.error('An unexpected error occurred');
					}
				};
			}}
			class="space-y-4 pt-4"
		>
			<div class="space-y-2">
				<Label for="name">Profile Name</Label>
				<Input
					id="name"
					name="name"
					bind:value={newName}
					placeholder="Enterprise Default"
					required
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="ns1">NS 1</Label>
					<Input id="ns1" name="ns1" bind:value={ns1} placeholder="ns1.example.com" required />
				</div>
				<div class="space-y-2">
					<Label for="ns2">NS 2</Label>
					<Input id="ns2" name="ns2" bind:value={ns2} placeholder="ns2.example.com" />
				</div>
				<div class="space-y-2">
					<Label for="ns3">NS 3</Label>
					<Input id="ns3" name="ns3" bind:value={ns3} placeholder="ns3.example.com" />
				</div>
				<div class="space-y-2">
					<Label for="ns4">NS 4</Label>
					<Input id="ns4" name="ns4" bind:value={ns4} placeholder="ns4.example.com" />
				</div>
			</div>

			<div class="space-y-2">
				<Label for="dnsProviderId">DNS API Provider</Label>
				<select
					id="dnsProviderId"
					name="dnsProviderId"
					bind:value={dnsProviderId}
					class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
				>
					<option value="">Manual Mode (No Sync)</option>
					{#each data.vpsProviders || [] as provider}
						<option value={provider.id}>{provider.name}</option>
					{/each}
				</select>
			</div>

			<Dialog.Footer>
				<Button type="submit" class="w-full">Create Profile</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={showShareModal}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Share Profile</Dialog.Title>
			<Dialog.Description
				>Share this nameserver profile with a user, team, or company.</Dialog.Description
			>
		</Dialog.Header>
		<form
			method="POST"
			action="?/share"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						showShareModal = false;
						shareAssigneeId = '';
						toastStore.success('Profile shared successfully');
						await update();
					} else if (result.type === 'failure') {
						toastStore.error(result.data?.message || 'Failed to share profile');
					} else {
						toastStore.error('An unexpected error occurred');
					}
				};
			}}
			class="space-y-4 pt-4"
		>
			<input type="hidden" name="profileId" value={selectedProfileId} />

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="assigneeType">Share With</Label>
					<select
						id="assigneeType"
						name="assigneeType"
						bind:value={shareAssigneeType}
						class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
					>
						<option value="user">User (Email)</option>
						<option value="team">Team (ID)</option>
						<option value="company">Company (ID)</option>
					</select>
				</div>
				<div class="space-y-2">
					<Label for="role">Role</Label>
					<select
						id="role"
						name="role"
						bind:value={shareRole}
						class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
					>
						<option value="use">Use (Read-Only)</option>
						<option value="manage">Manage (Edit)</option>
					</select>
				</div>
			</div>

			<div class="space-y-2">
				<Label for="assigneeId"
					>{shareAssigneeType === 'user'
						? 'User Email'
						: shareAssigneeType === 'team'
							? 'Team ID'
							: 'Company ID'}</Label
				>
				<Input
					id="assigneeId"
					name="assigneeId"
					bind:value={shareAssigneeId}
					placeholder={shareAssigneeType === 'user' ? 'user@example.com' : '...'}
					required
				/>
			</div>

			<Dialog.Footer>
				<Button type="submit" class="w-full">Share Profile</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
