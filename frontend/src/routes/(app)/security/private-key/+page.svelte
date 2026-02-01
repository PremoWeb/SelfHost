<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import { formatDate } from '$lib/utils/helpers';
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Dialog from '$lib/components/ui/dialog';
	import { KeyRound, Plus, ShieldCheck } from 'lucide-svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import StickyHeader from '$lib/components/StickyHeader.svelte';

	import AddKeyForm from '$lib/components/security/AddKeyForm.svelte';

	let { data }: { data: PageData } = $props();

	let showAddModal = $state(false);
</script>

<PageTitle title="Security Vault" />

<div class="space-y-6">
	<StickyHeader class="space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">Security</h1>
				<p class="text-muted-foreground mt-1">Manage your secure credentials and access tokens.</p>
			</div>
			<Button onclick={() => (showAddModal = true)}>
				<Plus class="mr-2 size-4" />
				New Key
			</Button>
		</div>

		<nav class="flex gap-4 border-b">
			<a
				href="/security/private-key"
				class="border-primary border-b-2 px-4 py-2 text-sm font-medium">Private Keys</a
			>
			<a
				href="/security/api-tokens"
				class="text-muted-foreground hover:text-foreground px-4 py-2 text-sm font-medium"
				>API Tokens</a
			>
		</nav>
	</StickyHeader>

	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each data.privateKeys as key}
			<Card.Root>
				<Card.Header>
					<div class="flex items-center gap-3">
						<KeyRound class="text-muted-foreground size-4" />
						<Card.Title class="text-lg">
							<a href="/security/private-key/{key.id}" class="hover:underline">{key.name}</a>
						</Card.Title>
					</div>
					{#if key.description}
						<Card.Description class="line-clamp-2">{key.description}</Card.Description>
					{/if}
				</Card.Header>
				<Card.Footer>
					<div class="text-muted-foreground text-[10px] tracking-widest uppercase">
						Registered {formatDate(key.createdAt.toString())}
					</div>
				</Card.Footer>
			</Card.Root>
		{:else}
			<div class="md:col-span-full border-2 border-dashed rounded-lg py-20 text-center">
				<p class="text-muted-foreground">Vault is empty.</p>
			</div>
		{/each}
	</div>
</div>

<Dialog.Root bind:open={showAddModal}>
	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title>Enroll Key</Dialog.Title>
			<Dialog.Description>Securely ingest a new SSH private key.</Dialog.Description>
		</Dialog.Header>
		<AddKeyForm />
	</Dialog.Content>
</Dialog.Root>
