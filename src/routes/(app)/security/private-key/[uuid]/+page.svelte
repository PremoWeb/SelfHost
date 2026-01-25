<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { toastStore } from '$lib/stores/toast';
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { ArrowLeft, Save, Trash2, ShieldAlert, Eye, EyeOff, Copy } from '@lucide/svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import StickyHeader from '$lib/components/StickyHeader.svelte';

	let { data }: { data: PageData } = $props();

	let key = $state(untrack(() => data.privateKey));
	let showPrivateKey = $state(false);
	$effect(() => {
		key = data.privateKey;
	});
	let isSaving = $state(false);
	let isDeleting = $state(false);

	function handleDeleteClick(e: Event) {
		if (!confirm('Are you sure you want to delete this key? This operation cannot be undone.')) {
			e.preventDefault();
		} else {
			isDeleting = true;
		}
	}
</script>

<PageTitle title="{key.name} - Private Key" />

<div class="space-y-6">
	<StickyHeader class="space-y-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<Button variant="outline" size="icon" href="/security/private-key">
					<ArrowLeft class="size-4" />
				</Button>
				<div class="flex flex-col gap-1">
					<h1 class="flex items-center gap-2 text-3xl font-bold tracking-tight">
						{key.name}
					</h1>
					<p class="text-muted-foreground flex items-center gap-2 text-sm">
						ID: <span class="text-muted-foreground/80 font-mono text-xs">{key.id}</span>
					</p>
				</div>
			</div>
			<div class="flex gap-2">
				<form
					method="POST"
					action="?/delete"
					use:enhance={() => {
						return async ({ result }: { result: any }) => {
							isDeleting = false;
							if (result.type === 'success') {
								toastStore.success('Key deleted');
								goto('/security/private-key');
							} else {
								toastStore.error(result.data?.message || 'Failed to delete key');
							}
						};
					}}
				>
					<Button
						variant="destructive"
						type="submit"
						onclick={handleDeleteClick}
						disabled={isDeleting}
						size="icon"
					>
						{#if isDeleting}
							<div
								class="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
							></div>
						{:else}
							<Trash2 class="size-4" />
						{/if}
					</Button>
				</form>
				<Button type="submit" form="edit-form" disabled={isSaving}>
					{#if isSaving}
						<div
							class="mr-2 size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
						></div>
					{:else}
						<Save class="mr-2 size-4" />
					{/if}
					Save Changes
				</Button>
			</div>
		</div>
	</StickyHeader>

	<div class="grid gap-6">
		<form
			id="edit-form"
			method="POST"
			action="?/update"
			use:enhance={() => {
				isSaving = true;
				return async ({ result }: { result: any }) => {
					isSaving = false;
					if (result.type === 'success') {
						toastStore.success('Key updated');
						if (result.data?.key) key = result.data.key;
					} else {
						toastStore.error(result.data?.message || 'Failed to update key');
					}
				};
			}}
		>
			<Card.Root>
				<Card.Header>
					<Card.Title>Key Configuration</Card.Title>
					<Card.Description>Manage the identity properties of this key.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-6">
					<div class="grid gap-2">
						<Label for="name">Name</Label>
						<Input id="name" name="name" bind:value={key.name} required />
					</div>

					<div class="grid gap-2">
						<Label for="description">Description</Label>
						<Input id="description" name="description" bind:value={key.description} />
					</div>

					<div class="grid gap-2">
						<div class="flex items-center justify-between">
							<Label for="privateKey">Private Key Content</Label>
							<Button
								variant="ghost"
								size="sm"
								class="h-6 gap-1 text-xs"
								onclick={(e) => {
									e.preventDefault();
									showPrivateKey = !showPrivateKey;
								}}
							>
								{#if showPrivateKey}
									<EyeOff class="size-3" /> Hide
								{:else}
									<Eye class="size-3" /> Show
								{/if}
							</Button>
						</div>
						{#if showPrivateKey}
							<Textarea
								id="privateKey"
								name="privateKey"
								bind:value={key.privateKey}
								required
								rows={12}
								class="font-mono text-xs whitespace-pre"
							/>
						{:else}
							<div class="relative">
								<Textarea
									disabled
									value="••••••••••••••••••••••••••••••••••••••••••••••••"
									rows={12}
									class="resize-none font-mono text-xs blur-[2px] select-none"
								/>
								<div class="absolute inset-0 flex items-center justify-center">
									<Button
										variant="outline"
										size="sm"
										onclick={(e) => {
											e.preventDefault();
											showPrivateKey = true;
										}}
									>
										Reveal Private Key
									</Button>
								</div>
							</div>
							<!-- Hidden input to ensure value is submitted if not editing? 
                                 Wait, if it's not rendered, bind:value might be lost? 
                                 No, 'key' object holds the state. 
                                 But form submission uses 'name' attributes. 
                                 If the real textarea is not in DOM, the form data won't include 'privateKey'.
                                 We need a hidden input when masked.
                            -->
							<input type="hidden" name="privateKey" value={key.privateKey} />
						{/if}
					</div>

					<div class="grid gap-2">
						{#if key.publicKey}
							<div class="flex items-center justify-between">
								<Label for="publicKey">Public Key</Label>
								<Button
									variant="ghost"
									size="sm"
									class="h-6 gap-1 text-xs"
									onclick={(e) => {
										e.preventDefault();
										if (key.publicKey) {
											navigator.clipboard.writeText(key.publicKey);
											toastStore.success('Public Key copied');
										}
									}}
								>
									<Copy class="size-3" /> Copy
								</Button>
							</div>
							<Textarea
								id="publicKey"
								readonly
								value={key.publicKey}
								rows={4}
								class="bg-muted/50 font-mono text-xs whitespace-pre"
							/>
							<p class="text-muted-foreground text-[10px]">
								This key is derived from the private key above. You can add this to your server's <code
									>~/.ssh/authorized_keys</code
								> file.
							</p>
						{:else}
							<div
								class="border-destructive/20 bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
							>
								<p class="font-medium">Unable to derive public key</p>
								<p class="mt-1 text-xs opacity-90">
									The private key content appears to be invalid or is not a valid PEM-formatted RSA
									key. Please verify the private key content.
								</p>
							</div>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
		</form>

		<div class="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
			<div class="flex items-start gap-4">
				<ShieldAlert class="mt-0.5 size-5 text-yellow-600" />
				<div class="space-y-1">
					<h4 class="font-medium text-yellow-900 dark:text-yellow-500">Security Warning</h4>
					<p class="text-sm text-yellow-800/80 dark:text-yellow-600/80">
						SelfHost uses this private key to SSH into your servers. It is stored encrypted in the
						database. Ensure you keep the original key safe, as SelfHost only needs the private part
						to establish connections.
					</p>
				</div>
			</div>
		</div>
	</div>
</div>
