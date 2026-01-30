<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ShieldAlert, Loader2, Key, Copy } from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toast';

	// Props - this would come from the parent component
	let { server } = $props<{ server: any }>();

	// State for the warning banner functionality
	let isReinstallDialogOpen = $state(false);
	let isReinstalling = $state(false);
	let isRetrievingPassword = $state(false);
	let retrievedPassword = $state('');
</script>

{#if !server.privateKeyId && server.vpsProviderId}
	<div
		class="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20"
	>
		<div class="flex items-start gap-3">
			<ShieldAlert class="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-500" />
			<div class="flex-1 space-y-3">
				<div>
					<p class="text-sm font-medium text-amber-900 dark:text-amber-100">
						No deployment key configured
					</p>
					<p class="mt-1 text-xs text-amber-700 dark:text-amber-300">
						This server is linked to a cloud provider but doesn't have an SSH key. You can
						auto-generate one and reinstall the server, or retrieve the password for manual setup.
					</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<Button
						variant="default"
						size="sm"
						onclick={() => (isReinstallDialogOpen = true)}
						disabled={isReinstalling}
						class="bg-amber-600 text-white hover:bg-amber-700"
					>
						{#if isReinstalling}
							<Loader2 class="mr-2 size-3 animate-spin" />
							Reinstalling...
						{:else}
							<Key class="mr-2 size-3" />
							Auto-Generate Key & Reinstall
						{/if}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={async () => {
							isRetrievingPassword = true;
							const formData = new FormData();
							const response = await fetch(`/servers/${server.id}?/retrievePassword`, {
								method: 'POST',
								body: formData
							});
							const result = await response.json();
							if (result.type === 'success' && result.data?.password) {
								retrievedPassword = result.data.password;
								toastStore.success('Password retrieved successfully');
							} else {
								toastStore.error(result.data?.message || 'Failed to retrieve password');
							}
							isRetrievingPassword = false;
						}}
						disabled={isRetrievingPassword}
					>
						{#if isRetrievingPassword}
							<Loader2 class="mr-2 size-3 animate-spin" />
						{:else}
							<Key class="mr-2 size-3" />
						{/if}
						Retrieve Password
					</Button>
				</div>
				{#if retrievedPassword}
					<div class="bg-background rounded border p-3">
						<div class="mb-2 flex items-center justify-between">
							<p class="text-xs font-medium">Root Password:</p>
							<Button
								variant="ghost"
								size="sm"
								class="h-6 px-2"
								onclick={() => {
									navigator.clipboard.writeText(retrievedPassword);
									toastStore.success('Password copied to clipboard');
								}}
							>
								<Copy class="mr-1 size-3" />
								Copy
							</Button>
						</div>
						<code class="font-mono text-xs break-all">{retrievedPassword}</code>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
