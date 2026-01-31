<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { toast } from 'svelte-sonner';

	export let open = false;

	const dispatch = createEventDispatcher();

	let title = '';
	let publicKey = '';
	let submitting = false;
	let errors: { title?: string; publicKey?: string } = {};

	function validateForm(): boolean {
		errors = {};

		if (!title.trim()) {
			errors.title = 'Title is required';
		}

		if (!publicKey.trim()) {
			errors.publicKey = 'Public key is required';
		} else {
			// Basic SSH key format validation
			const keyParts = publicKey.trim().split(' ');
			if (keyParts.length < 2) {
				errors.publicKey = 'Invalid SSH key format';
			} else {
				const keyType = keyParts[0];
				const validTypes = [
					'ssh-rsa',
					'ssh-ed25519',
					'ecdsa-sha2-nistp256',
					'ecdsa-sha2-nistp384',
					'ecdsa-sha2-nistp521'
				];
				if (!validTypes.includes(keyType)) {
					errors.publicKey = `Invalid key type. Must be one of: ${validTypes.join(', ')}`;
				}
			}
		}

		return Object.keys(errors).length === 0;
	}

	async function handleSubmit() {
		if (!validateForm()) {
			return;
		}

		submitting = true;

		try {
			const response = await fetch('/api/ssh/keys', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					title: title.trim(),
					publicKey: publicKey.trim()
				})
			});

			const data = await response.json();

			if (response.ok) {
				toast.success('SSH key added successfully');
				title = '';
				publicKey = '';
				errors = {};
				dispatch('success');
			} else {
				toast.error(data.message || 'Failed to add SSH key');
				if (data.message?.includes('already exists')) {
					errors.publicKey = 'This SSH key already exists';
				}
			}
		} catch (error) {
			console.error('Failed to add SSH key:', error);
			toast.error('Failed to add SSH key');
		} finally {
			submitting = false;
		}
	}

	function handleOpenChange(newOpen: boolean) {
		open = newOpen;
		if (!newOpen) {
			// Reset form when dialog closes
			title = '';
			publicKey = '';
			errors = {};
		}
	}
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent class="sm:max-w-[600px]">
		<DialogHeader>
			<DialogTitle>Add SSH Key</DialogTitle>
			<DialogDescription>
				Add a new SSH public key to enable Git operations over SSH. You can generate an SSH key
				using <code class="bg-secondary rounded px-1 py-0.5"
					>ssh-keygen -t ed25519 -C "your_email@example.com"</code
				>
			</DialogDescription>
		</DialogHeader>

		<form on:submit|preventDefault={handleSubmit} class="space-y-4">
			<div class="space-y-2">
				<Label for="title">Title</Label>
				<Input
					id="title"
					bind:value={title}
					placeholder="My Laptop"
					class={errors.title ? 'border-destructive' : ''}
					disabled={submitting}
				/>
				{#if errors.title}
					<p class="text-destructive text-sm">{errors.title}</p>
				{/if}
				<p class="text-muted-foreground text-sm">
					A descriptive name for this key (e.g., "Work Laptop", "Home Desktop")
				</p>
			</div>

			<div class="space-y-2">
				<Label for="publicKey">Public Key</Label>
				<Textarea
					id="publicKey"
					bind:value={publicKey}
					placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... your_email@example.com"
					rows={6}
					class={`font-mono text-sm ${errors.publicKey ? 'border-destructive' : ''}`}
					disabled={submitting}
				/>
				{#if errors.publicKey}
					<p class="text-destructive text-sm">{errors.publicKey}</p>
				{/if}
				<p class="text-muted-foreground text-sm">
					Paste your public key here. It should start with ssh-rsa, ssh-ed25519, or ecdsa-sha2-*
				</p>
			</div>

			<DialogFooter>
				<Button
					type="button"
					variant="outline"
					on:click={() => (open = false)}
					disabled={submitting}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={submitting}>
					{#if submitting}
						Adding...
					{:else}
						Add SSH Key
					{/if}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
