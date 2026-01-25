<script lang="ts">
	import { serversApi } from '$lib/api/resources/servers';
	import { toastStore } from '$lib/stores/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { goto } from '$app/navigation';

	interface Props {
		privateKeys: any[];
		onSuccess?: (server: any) => void;
	}

	let { privateKeys, onSuccess }: Props = $props();

	let name = $state('');
	let description = $state('');
	let ip = $state('');
	let port = $state(22);
	let user = $state('root');
	let privateKeyId = $state('');
	let tagsString = $state('');
	let isCreating = $state(false);

	async function handleCreate() {
		isCreating = true;
		try {
			const result = await serversApi.create({
				name,
				description,
				ip,
				port,
				user,
				private_key_id: Number(privateKeyId),
				tags: tagsString
					? tagsString
							.split(',')
							.map((t) => t.trim())
							.filter((t) => t)
					: []
			});
			toastStore.success('Server Registered');
			if (onSuccess) {
				onSuccess(result);
			} else {
				goto('/servers');
			}
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to register');
		} finally {
			isCreating = false;
		}
	}
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		handleCreate();
	}}
	class="space-y-4 pt-4"
	autocomplete="off"
>
	<div class="grid grid-cols-2 gap-4">
		<div class="space-y-2">
			<Label for="name">Name</Label>
			<Input id="name" bind:value={name} placeholder="Web Server 01" required />
		</div>
		<div class="space-y-2">
			<Label for="ip">IP/FQDN</Label>
			<Input id="ip" bind:value={ip} placeholder="1.2.3.4" required />
		</div>
	</div>
	<div class="grid grid-cols-2 gap-4">
		<div class="space-y-2">
			<Label for="user">User</Label>
			<Input id="user" bind:value={user} placeholder="root" required />
		</div>
		<div class="space-y-2">
			<Label for="port">Port</Label>
			<Input id="port" type="number" bind:value={port} required />
		</div>
	</div>
	<div class="space-y-2">
		<Label for="description">Description (Optional)</Label>
		<Input id="description" bind:value={description} placeholder="Production web server" />
	</div>
	<div class="space-y-2">
		<Label for="tags">Tags (comma-separated)</Label>
		<Input id="tags" bind:value={tagsString} placeholder="prod, web, us-east" />
	</div>
	<div class="space-y-2">
		<Label for="pk">Private Key</Label>
		<select
			id="pk"
			bind:value={privateKeyId}
			class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
			required
		>
			<option value="">Select a key...</option>
			{#each privateKeys as pk}
				<option value={pk.id}>{pk.name}</option>
			{/each}
		</select>
	</div>
	<Button type="submit" class="w-full" disabled={isCreating}>
		{isCreating ? 'Registering...' : 'Register Server'}
	</Button>
</form>
