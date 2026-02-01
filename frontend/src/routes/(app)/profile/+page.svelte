<script lang="ts">
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import { invalidateAll } from '$app/navigation';
	import { formatDate } from '$lib/utils/helpers';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import { addSshKeyRemote, deleteSshKeyRemote } from '../ssh.remote';
    import * as Card from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as Table from "$lib/components/ui/table";
	import { Badge } from "$lib/components/ui/badge";
	import { Key, Plus, Trash2, Copy, Check } from 'lucide-svelte';
	
	const { TableHeader, TableBody, TableRow, TableCell, TableHead } = Table;

	import { untrack } from 'svelte';
	let { data }: { data: PageData } = $props();

	let user = $state(untrack(() => data.user));
	$effect(() => { user = data.user; });
	let isSaving = $state(false);

	function formatLastUsed(date: Date | string | null | undefined): string {
		if (!date) return 'Never';
		const dateObj = date instanceof Date ? date : new Date(date);
		return formatDate(dateObj.toISOString());
	}
	
	// SSH Keys state
	let showAddSshKeyModal = $state(false);
	let sshKeyTitle = $state('');
	let sshKeyPublicKey = $state('');
	let isAddingSshKey = $state(false);
	let copiedFingerprint = $state<string | null>(null);

	async function handleSave() {
		isSaving = true;
		try {
			const { id, createdAt, updatedAt, ...payload } = user;
			const response = (await api.patch('/profile', payload)) as any;
			user = response.data.data;
			toastStore.success('Profile updated');
		} catch (error: any) {
			toastStore.error('Failed to update');
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b pb-6">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-bold tracking-tight">User Profile</h1>
			<p class="text-muted-foreground">Manage your personal identity and account credentials.</p>
		</div>
		<Button onclick={handleSave} disabled={isSaving}>
			{isSaving ? 'Saving...' : 'Update Profile'}
		</Button>
	</div>

	<div class="grid gap-6 md:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Identity Details</Card.Title>
				<Card.Description>Primary information used across the platform.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="name">Display Name</Label>
					<Input id="name" bind:value={user.name} />
				</div>
                <div class="space-y-2">
                    <Label for="email">Email Address</Label>
                    <Input id="email" bind:value={user.email} />
                </div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Credential Management</Card.Title>
				<Card.Description>Secure access controls for your account.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
                <div class="p-4 bg-muted/50 border rounded-lg text-xs text-muted-foreground text-center italic">
                    Self-service password rotation is currently restricted.
                </div>
				<div class="grid gap-4 opacity-50 grayscale select-none pointer-events-none">
					<div class="space-y-2">
						<Label>Current Password</Label>
						<Input type="password" value="********" readonly />
					</div>
					<div class="space-y-2">
						<Label>New Password</Label>
						<Input type="password" value="********" readonly />
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- SSH Keys Management -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between">
				<div>
					<Card.Title>SSH Keys</Card.Title>
					<Card.Description>
						Manage SSH keys for Git over SSH access to built-in repositories.
					</Card.Description>
				</div>
				<Button onclick={() => (showAddSshKeyModal = true)}>
					<Plus class="mr-2 size-4" />
					Add SSH Key
				</Button>
			</div>
		</Card.Header>
		<Card.Content>
			{#if data.sshKeys && data.sshKeys.length > 0}
				<Table.Root>
					<TableHeader>
						<TableRow>
							<TableHead>Title</TableHead>
							<TableHead>Key Type</TableHead>
							<TableHead>Fingerprint</TableHead>
							<TableHead>Last Used</TableHead>
							<TableHead class="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each data.sshKeys as key}
							<TableRow>
								<TableCell class="font-medium">{key.title}</TableCell>
								<TableCell>
									<Badge variant="outline" class="text-xs">{key.keyType}</Badge>
								</TableCell>
								<TableCell>
									<div class="flex items-center gap-2">
										<code class="bg-muted/50 rounded px-1.5 py-0.5 font-mono text-[10px]">
											{key.fingerprint.substring(0, 20)}...
										</code>
										<Button
											variant="ghost"
											size="sm"
											class="h-6 w-6 p-0"
											onclick={async () => {
												await navigator.clipboard.writeText(key.fingerprint);
												copiedFingerprint = key.id;
												setTimeout(() => copiedFingerprint = null, 2000);
											}}
										>
											{#if copiedFingerprint === key.id}
												<Check class="size-3 text-green-600" />
											{:else}
												<Copy class="size-3" />
											{/if}
										</Button>
									</div>
								</TableCell>
								<TableCell class="text-muted-foreground text-sm">
									{formatLastUsed(key.lastUsedAt)}
								</TableCell>
								<TableCell class="text-right">
									<Button
										variant="ghost"
										size="sm"
										class="text-destructive hover:text-destructive hover:bg-destructive/10"
										onclick={async () => {
											if (!confirm(`Are you sure you want to delete "${key.title}"?`)) return;
											
											try {
												const response = await deleteSshKeyRemote({ keyId: key.id });
												
												if (!response.success) {
													throw new Error(response.message || 'Failed to delete SSH key');
												}
												
												toastStore.success('SSH key deleted successfully');
												await invalidateAll();
											} catch (error: any) {
												toastStore.error(error.message || 'Failed to delete SSH key');
											}
										}}
									>
										<Trash2 class="size-4" />
									</Button>
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table.Root>
			{:else}
				<div class="py-8 text-center">
					<div class="bg-muted/30 border-border/50 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border">
						<Key class="text-muted-foreground size-5" />
					</div>
					<p class="text-muted-foreground mb-1 text-sm font-medium">No SSH keys</p>
					<p class="text-muted-foreground mb-6 text-xs">
						Add an SSH key to enable Git over SSH access to your repositories.
					</p>
					<Button onclick={() => (showAddSshKeyModal = true)}>
						<Plus class="mr-2 size-4" />
						Add SSH Key
					</Button>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

<!-- Add SSH Key Dialog -->
<Dialog.Root bind:open={showAddSshKeyModal}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Add SSH Key</Dialog.Title>
			<Dialog.Description>
				Add a public SSH key to enable Git over SSH access.
			</Dialog.Description>
		</Dialog.Header>

		<form
			onsubmit={async (e) => {
				e.preventDefault();
				if (!sshKeyTitle.trim() || !sshKeyPublicKey.trim()) {
					toastStore.error('Title and public key are required');
					return;
				}
				
				isAddingSshKey = true;
				try {
					const response = await addSshKeyRemote({
						title: sshKeyTitle.trim(),
						publicKey: sshKeyPublicKey.trim()
					});
					
					if (!response.success) {
						throw new Error(response.message || 'Failed to add SSH key');
					}
					
					toastStore.success('SSH key added successfully');
					showAddSshKeyModal = false;
					sshKeyTitle = '';
					sshKeyPublicKey = '';
					await invalidateAll();
				} catch (error: any) {
					toastStore.error(error.message || 'Failed to add SSH key');
				} finally {
					isAddingSshKey = false;
				}
			}}
			class="pt-4"
		>
			<div class="space-y-4">
				<div class="grid gap-2">
					<Label for="ssh-key-title">Title</Label>
					<Input
						id="ssh-key-title"
						bind:value={sshKeyTitle}
						placeholder="My Laptop"
						required
					/>
					<p class="text-muted-foreground text-xs">
						A friendly name to identify this key (e.g., "My Laptop", "Work Desktop")
					</p>
				</div>

				<div class="grid gap-2">
					<Label for="ssh-key-public">Public Key</Label>
					<textarea
						id="ssh-key-public"
						bind:value={sshKeyPublicKey}
						placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ..."
						required
						class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
					></textarea>
					<p class="text-muted-foreground text-xs">
						Paste your public SSH key here. Usually found in <code>~/.ssh/id_rsa.pub</code> or <code>~/.ssh/id_ed25519.pub</code>
					</p>
				</div>
			</div>

			<Dialog.Footer class="pt-6">
				<Button
					type="button"
					variant="outline"
					onclick={() => {
						showAddSshKeyModal = false;
						sshKeyTitle = '';
						sshKeyPublicKey = '';
					}}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={isAddingSshKey}>
					{isAddingSshKey ? 'Adding...' : 'Add SSH Key'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
