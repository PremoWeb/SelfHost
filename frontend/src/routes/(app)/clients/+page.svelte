<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Table from '$lib/components/ui/table';
	import * as Dialog from '$lib/components/ui/dialog';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import StickyHeader from '$lib/components/StickyHeader.svelte';
	import {
		Plus,
		Search,
		User,
		Building2,
		Mail,
		Phone,
		MoreVertical,
		Pencil,
		Trash2
	} from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toast';

	let { data }: { data: PageData } = $props();

	let showAddModal = $state(false);
	let showEditModal = $state(false);
	let searchQuery = $state('');
	let isSubmitting = $state(false);

	let editingClient = $state<any>(null);

	let filteredClients = $derived(
		data.clients.filter(
			(c) =>
				c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				c.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				c.email?.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	function openEdit(client: any) {
		editingClient = { ...client };
		showEditModal = true;
	}
</script>

<PageTitle title="CRM & Clients" />

<div class="space-y-6">
	<StickyHeader class="space-y-4">
		<div class="flex items-center justify-between">
			<div class="flex flex-col gap-1">
				<h1 class="text-foreground text-3xl font-bold tracking-tight">CRM & Clients</h1>
				<p class="text-muted-foreground">Manage your customers and assign them to projects.</p>
			</div>
			<Button onclick={() => (showAddModal = true)}>
				<Plus class="mr-2 size-4" />
				Add Client
			</Button>
		</div>

		<div class="relative">
			<Search class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
			<Input
				bind:value={searchQuery}
				placeholder="Search clients by name, company, or email..."
				class="h-11 pl-10"
				autofocus
			/>
		</div>
	</StickyHeader>

	<Card.Root>
		<Card.Content class="p-0">
			{#if filteredClients.length > 0}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Client Name</Table.Head>
							<Table.Head>Company</Table.Head>
							<Table.Head>Contact Info</Table.Head>
							<Table.Head class="text-right">Actions</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each filteredClients as client}
							<Table.Row>
								<Table.Cell>
									<div class="flex items-center gap-3">
										<div
											class="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-xs font-bold"
										>
											{client.name.charAt(0).toUpperCase()}
										</div>
										<a
											href="/clients/{client.id}"
											class="text-foreground font-medium hover:underline">{client.name}</a
										>
									</div>
								</Table.Cell>
								<Table.Cell>
									<div class="text-muted-foreground flex items-center gap-2">
										<Building2 class="size-3.5" />
										<span>{client.company || '—'}</span>
									</div>
								</Table.Cell>
								<Table.Cell>
									<div class="flex flex-col gap-1">
										{#if client.email}
											<div class="text-muted-foreground flex items-center gap-2 text-xs">
												<Mail class="size-3" />
												{client.email}
											</div>
										{/if}
										{#if client.phone}
											<div class="text-muted-foreground flex items-center gap-2 text-xs">
												<Phone class="size-3" />
												{client.phone}
											</div>
										{/if}
									</div>
								</Table.Cell>
								<Table.Cell class="text-right">
									<div class="flex justify-end gap-2">
										<Button variant="ghost" size="icon-sm" onclick={() => openEdit(client)}>
											<Pencil class="size-4" />
										</Button>
										<form
											method="POST"
											action="?/delete"
											use:enhance={() => {
												return async ({ result, update }) => {
													if (result.type === 'success') {
														toastStore.success('Client deleted');
														await update();
													}
												};
											}}
										>
											<input type="hidden" name="id" value={client.id} />
											<Button variant="ghost" size="icon-sm" type="submit" class="text-destructive">
												<Trash2 class="size-4" />
											</Button>
										</form>
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{:else}
				<div class="flex flex-col items-center gap-4 py-20 text-center">
					<User class="text-muted-foreground size-12 opacity-20" />
					<p class="text-muted-foreground italic">No clients found.</p>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

<!-- Add Client Modal -->
<Dialog.Root bind:open={showAddModal}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add New Client</Dialog.Title>
			<Dialog.Description>Create a new client profile for your CRM.</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ result, update }) => {
					isSubmitting = false;
					if (result.type === 'success') {
						showAddModal = false;
						toastStore.success('Client added');
						await update();
					}
				};
			}}
			class="space-y-4 pt-4"
			autocomplete="off"
		>
			<div class="space-y-2">
				<Label for="name">Full Name</Label>
				<Input id="name" name="name" placeholder="John Doe" required />
			</div>
			<div class="space-y-2">
				<Label for="company">Company</Label>
				<Input id="company" name="company" placeholder="Acme Inc." />
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="email">Email</Label>
					<Input id="email" name="email" type="email" placeholder="john@example.com" />
				</div>
				<div class="space-y-2">
					<Label for="phone">Phone</Label>
					<Input id="phone" name="phone" placeholder="+1 (555) 000-0000" />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="submit" class="w-full" disabled={isSubmitting}>
					{isSubmitting ? 'Creating...' : 'Create Client'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit Client Modal -->
<Dialog.Root bind:open={showEditModal}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Edit Client</Dialog.Title>
			<Dialog.Description>Update client information.</Dialog.Description>
		</Dialog.Header>
		{#if editingClient}
			<form
				method="POST"
				action="?/update"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ result, update }) => {
						isSubmitting = false;
						if (result.type === 'success') {
							showEditModal = false;
							toastStore.success('Client updated');
							await update();
						}
					};
				}}
				class="space-y-4 pt-4"
				autocomplete="off"
			>
				<input type="hidden" name="id" value={editingClient.id} />
				<div class="space-y-2">
					<Label for="edit-name">Full Name</Label>
					<Input id="edit-name" name="name" bind:value={editingClient.name} required />
				</div>
				<div class="space-y-2">
					<Label for="edit-company">Company</Label>
					<Input id="edit-company" name="company" bind:value={editingClient.company} />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="edit-email">Email</Label>
						<Input id="edit-email" name="email" type="email" bind:value={editingClient.email} />
					</div>
					<div class="space-y-2">
						<Label for="edit-phone">Phone</Label>
						<Input id="edit-phone" name="phone" bind:value={editingClient.phone} />
					</div>
				</div>
				<Dialog.Footer>
					<Button type="submit" class="w-full" disabled={isSubmitting}>
						{isSubmitting ? 'Saving...' : 'Save Changes'}
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
