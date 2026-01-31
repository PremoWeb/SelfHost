<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Plus, Key, Trash2, Copy, Check } from 'lucide-svelte';
	import AddSshKeyDialog from './AddSshKeyDialog.svelte';
	import { toast } from 'svelte-sonner';

	interface SshKey {
		id: string;
		user_id: string;
		title: string;
		key_type: string;
		fingerprint: string;
		last_used_at: number | null;
		created_at: number;
	}

	let keys: SshKey[] = [];
	let loading = true;
	let showAddDialog = false;
	let copiedFingerprint: string | null = null;

	onMount(async () => {
		await loadKeys();
	});

	async function loadKeys() {
		loading = true;
		try {
			const response = await fetch('/api/ssh/keys');
			const data = await response.json();
			keys = data.data || [];
		} catch (error) {
			console.error('Failed to load SSH keys:', error);
			toast.error('Failed to load SSH keys');
		} finally {
			loading = false;
		}
	}

	async function deleteKey(keyId: string, title: string) {
		if (!confirm(`Are you sure you want to delete the SSH key "${title}"?`)) {
			return;
		}

		try {
			const response = await fetch(`/api/ssh/keys/${keyId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				toast.success('SSH key deleted successfully');
				await loadKeys();
			} else {
				toast.error('Failed to delete SSH key');
			}
		} catch (error) {
			console.error('Failed to delete SSH key:', error);
			toast.error('Failed to delete SSH key');
		}
	}

	function copyFingerprint(fingerprint: string) {
		navigator.clipboard.writeText(fingerprint);
		copiedFingerprint = fingerprint;
		toast.success('Fingerprint copied to clipboard');
		setTimeout(() => {
			copiedFingerprint = null;
		}, 2000);
	}

	function formatDate(timestamp: number | null): string {
		if (!timestamp) return 'Never';
		return new Date(timestamp * 1000).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function handleKeyAdded() {
		showAddDialog = false;
		loadKeys();
	}
</script>

<div class="container mx-auto max-w-5xl space-y-6 p-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">SSH Keys</h1>
			<p class="text-muted-foreground mt-1">Manage SSH keys for Git repository access</p>
		</div>
		<Button on:click={() => (showAddDialog = true)}>
			<Plus class="mr-2 h-4 w-4" />
			Add SSH Key
		</Button>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
		</div>
	{:else if keys.length === 0}
		<Card class="p-12 text-center">
			<Key class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
			<h3 class="mb-2 text-lg font-semibold">No SSH keys</h3>
			<p class="text-muted-foreground mb-6">
				Add an SSH key to enable secure Git operations over SSH
			</p>
			<Button on:click={() => (showAddDialog = true)}>
				<Plus class="mr-2 h-4 w-4" />
				Add your first SSH key
			</Button>
		</Card>
	{:else}
		<div class="space-y-4">
			{#each keys as key (key.id)}
				<Card class="p-6">
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="mb-2 flex items-center gap-3">
								<Key class="text-muted-foreground h-5 w-5" />
								<h3 class="text-lg font-semibold">{key.title}</h3>
								<span
									class="bg-secondary text-secondary-foreground rounded px-2 py-1 font-mono text-xs"
								>
									{key.key_type}
								</span>
							</div>

							<div class="ml-8 space-y-2">
								<div class="flex items-center gap-2">
									<span class="text-muted-foreground text-sm">Fingerprint:</span>
									<code class="bg-secondary rounded px-2 py-1 font-mono text-sm">
										{key.fingerprint}
									</code>
									<button
										on:click={() => copyFingerprint(key.fingerprint)}
										class="hover:bg-secondary rounded p-1 transition-colors"
										title="Copy fingerprint"
									>
										{#if copiedFingerprint === key.fingerprint}
											<Check class="h-4 w-4 text-green-600" />
										{:else}
											<Copy class="text-muted-foreground h-4 w-4" />
										{/if}
									</button>
								</div>

								<div class="text-muted-foreground flex items-center gap-4 text-sm">
									<span>Added {formatDate(key.created_at)}</span>
									{#if key.last_used_at}
										<span>• Last used {formatDate(key.last_used_at)}</span>
									{:else}
										<span>• Never used</span>
									{/if}
								</div>
							</div>
						</div>

						<Button
							variant="ghost"
							size="sm"
							on:click={() => deleteKey(key.id, key.title)}
							class="text-destructive hover:text-destructive hover:bg-destructive/10"
						>
							<Trash2 class="h-4 w-4" />
						</Button>
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</div>

<AddSshKeyDialog bind:open={showAddDialog} on:success={handleKeyAdded} />

<style>
	:global(body) {
		background: hsl(var(--background));
	}
</style>
