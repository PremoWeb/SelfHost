<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
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
	export let projectId: string;

	const dispatch = createEventDispatcher();

	let name = '';
	let description = '';
	let isPrivate = false;
	let submitting = false;
	let errors: { name?: string; description?: string } = {};

	function validateForm(): boolean {
		errors = {};

		if (!name.trim()) {
			errors.name = 'Repository name is required';
		} else if (!/^[a-z0-9-]+$/.test(name.trim())) {
			errors.name = 'Repository name must contain only lowercase letters, numbers, and hyphens';
		}

		return Object.keys(errors).length === 0;
	}

	async function handleSubmit() {
		if (!validateForm()) {
			return;
		}

		submitting = true;

		try {
			const response = await fetch('/api/git/repositories', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					projectId,
					name: name.trim(),
					description: description.trim() || undefined,
					isPrivate
				})
			});

			const data = await response.json();

			if (response.ok) {
				toast.success('Repository created successfully');
				name = '';
				description = '';
				isPrivate = false;
				errors = {};
				dispatch('success');
			} else {
				toast.error(data.message || 'Failed to create repository');
				if (data.message?.includes('already exists')) {
					errors.name = 'A repository already exists for this project';
				}
			}
		} catch (error) {
			console.error('Failed to create repository:', error);
			toast.error('Failed to create repository');
		} finally {
			submitting = false;
		}
	}

	function handleOpenChange(newOpen: boolean) {
		open = newOpen;
		if (!newOpen) {
			// Reset form when dialog closes
			name = '';
			description = '';
			isPrivate = false;
			errors = {};
		}
	}

	function slugifyName(value: string) {
		name = value
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
	}
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent class="sm:max-w-[500px]">
		<DialogHeader>
			<DialogTitle>Create Git Repository</DialogTitle>
			<DialogDescription>
				Create a new Git repository for this project. You'll be able to push and pull code using Git
				over HTTP or SSH.
			</DialogDescription>
		</DialogHeader>

		<form on:submit|preventDefault={handleSubmit} class="space-y-4">
			<div class="space-y-2">
				<Label for="name">Repository Name</Label>
				<Input
					id="name"
					bind:value={name}
					on:input={(e) => slugifyName(e.currentTarget.value)}
					placeholder="my-project"
					class={errors.name ? 'border-destructive' : ''}
					disabled={submitting}
				/>
				{#if errors.name}
					<p class="text-destructive text-sm">{errors.name}</p>
				{/if}
				<p class="text-muted-foreground text-sm">
					Use lowercase letters, numbers, and hyphens only
				</p>
			</div>

			<div class="space-y-2">
				<Label for="description">Description (optional)</Label>
				<Textarea
					id="description"
					bind:value={description}
					placeholder="A brief description of your repository"
					rows={3}
					disabled={submitting}
				/>
				{#if errors.description}
					<p class="text-destructive text-sm">{errors.description}</p>
				{/if}
			</div>

			<div class="flex items-center space-x-2">
				<Checkbox id="private" bind:checked={isPrivate} disabled={submitting} />
				<Label for="private" class="cursor-pointer text-sm font-normal">
					Make this repository private
				</Label>
			</div>
			<p class="text-muted-foreground ml-6 text-sm">
				Private repositories are only accessible to authorized users
			</p>

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
						Creating...
					{:else}
						Create Repository
					{/if}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
