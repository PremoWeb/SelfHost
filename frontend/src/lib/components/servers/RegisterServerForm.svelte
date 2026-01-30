<script lang="ts">
	import { serversApi } from '$lib/api/resources/servers';
	import { toastStore } from '$lib/stores/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { goto } from '$app/navigation';

	interface Props {
		privateKeys: any[];
		accessTokens?: any[];
		onSuccess?: (server: any) => void;
	}

	let { privateKeys, accessTokens = [], onSuccess }: Props = $props();

	let name = $state('');
	let description = $state('');
	let ip = $state('');
	let port = $state(22);
	let user = $state('root');
	let privateKeyId = $state('');
	let tagsString = $state('');
	let cfHostname = $state('');
	let cfTokenId = $state('');
	let isProxmox = $state(false);
	let isCreating = $state(false);

	async function handleCreate() {
		isCreating = true;

		// Auto-tag proxmox
		let tags = tagsString
			? tagsString
					.split(',')
					.map((t) => t.trim())
					.filter((t) => t)
			: [];

		if (isProxmox && !tags.includes('proxmox')) {
			tags.push('proxmox');
		}

		try {
			const result = await serversApi.create({
				name,
				description,
				ip,
				port,
				user,
				private_key_id: Number(privateKeyId),
				tags,
				cloudflare_tunnel_hostname: cfHostname || null,
				cloudflare_access_token_id: cfTokenId || null
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

	<!-- Cloudflare Tunnel Section -->
	<div class="bg-muted/40 space-y-4 rounded-lg border p-4">
		<div class="flex items-center justify-between">
			<Label class="text-orange-600 dark:text-orange-400">Cloudflare Tunnel (Optional)</Label>
		</div>
		<div class="space-y-2">
			<Label for="cfHostname" class="text-xs">Tunnel Hostname</Label>
			<Input id="cfHostname" bind:value={cfHostname} placeholder="ssh.example.com" />
			<p class="text-muted-foreground text-[10px]">
				Use this hostname to connect via Cloudflare Tunnel.
			</p>
		</div>
		{#if accessTokens.length > 0}
			<div class="space-y-2">
				<Label for="cfToken" class="text-xs">Access Service Token</Label>
				<select
					id="cfToken"
					bind:value={cfTokenId}
					class="bg-background border-input ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus:ring-1 focus:outline-none"
				>
					<option value="">No Service Token</option>
					{#each accessTokens as token}
						<option value={token.id}>{token.name}</option>
					{/each}
				</select>
			</div>
		{/if}
	</div>

	<div class="space-y-2">
		<Label for="tags">Tags (comma-separated)</Label>
		<Input id="tags" bind:value={tagsString} placeholder="prod, web, us-east" />
		<div class="flex items-center gap-2 pt-1">
			<input
				type="checkbox"
				id="isProxmox"
				bind:checked={isProxmox}
				class="size-4 rounded border-gray-300"
			/>
			<Label for="isProxmox" class="font-normal">This is a Proxmox Server</Label>
		</div>
	</div>

	<div class="space-y-2">
		<Label for="pk">Private Key</Label>
		<select
			id="pk"
			bind:value={privateKeyId}
			class="bg-background border-input ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
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
