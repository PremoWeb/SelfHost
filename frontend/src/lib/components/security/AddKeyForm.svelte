<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastStore } from '$lib/stores/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { KeyRound } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';

	interface Props {
		onSuccess?: (key: any) => void;
		defaultName?: string;
	}

	let { onSuccess, defaultName = '' }: Props = $props();

	let name = $state(untrack(() => defaultName));
	let description = $state('');
	let privateKey = $state('');
	let isCreating = $state(false);
	let isGenerating = $state(false);

	// Update name when defaultName changes (only if name is empty)
	$effect(() => {
		if (defaultName && !name) {
			name = defaultName;
		}
	});

	function resetForm() {
		name = defaultName || '';
		description = '';
		privateKey = '';
	}
</script>

<form
	method="POST"
	action="/security/private-key?/create"
	use:enhance={({ action, cancel }) => {
		if (action.search === '?/generate') {
			isGenerating = true;
			return async ({ result }: { result: any }) => {
				isGenerating = false;
				if (result.type === 'success' && result.data?.privateKey) {
					privateKey = result.data.privateKey;
					toastStore.success('New key pair generated');
				} else {
					toastStore.error('Failed to generate key');
				}
			};
		}

		if (action.search === '?/create') {
			isCreating = true;
			return async ({ result, update }: { result: any; update: any }) => {
				isCreating = false;
				if (result.type === 'success') {
					toastStore.success('Key added to vault');
					resetForm();
					if (onSuccess) {
						onSuccess(result.data?.key);
					} else {
						await update();
						if (result.data?.key?.id) {
							goto(`/security/private-key/${result.data.key.id}`);
						}
					}
				} else {
					toastStore.error(result.data?.message || 'Enrolment failed');
				}
			};
		}
	}}
	class="space-y-4 pt-4"
	autocomplete="off"
>
	<div class="grid gap-2">
		<Label for="name">Key Name</Label>
		<Input id="name" name="name" bind:value={name} placeholder="Production Key" required />
	</div>
	<div class="grid gap-2">
		<Label for="desc">Description</Label>
		<Input
			id="desc"
			name="description"
			bind:value={description}
			placeholder="Access for main servers"
		/>
	</div>
	<div class="grid gap-2">
		<div class="flex items-center justify-between">
			<Label for="pk">Private Key Content</Label>
			<Button
				variant="outline"
				size="sm"
				type="submit"
				formaction="/security/private-key?/generate"
				formnovalidate
				disabled={isGenerating}
			>
				{#if isGenerating}
					<span
						class="mr-2 size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
					></span>
				{:else}
					<KeyRound class="mr-2 size-3" />
				{/if}
				Generate
			</Button>
		</div>
		<Textarea
			id="pk"
			name="privateKey"
			bind:value={privateKey}
			rows={6}
			class="font-mono text-xs"
			placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
			required
		/>
	</div>
	<Button
		type="submit"
		formaction="/security/private-key?/create"
		class="w-full"
		disabled={isCreating}
	>
		{isCreating ? 'Enrolling...' : 'Enroll Private Key'}
	</Button>
</form>
