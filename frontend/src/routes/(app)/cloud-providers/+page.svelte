<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { toastStore } from '$lib/stores/toast';
	import { api } from '$lib/api/client';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import * as Dialog from '$lib/components/ui/dialog';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import StickyHeader from '$lib/components/StickyHeader.svelte';
	import { RefreshCcw, Unplug, Cloud, ExternalLink, Plus, ShieldCheck } from '@lucide/svelte';

	import * as AlertDialog from '$lib/components/ui/alert-dialog';

	let { data }: { data: PageData } = $props();

	let showAddModal = $state(false);
	let newProviderName = $state('');
	let newProviderType = $state('vultr');
	let newProviderApiKey = $state('');
	let newCfClientId = $state('');
	let newCfClientSecret = $state('');
	let submitting = $state(false);

	let providerToDelete = $state<any>(null);

	async function handleCreate(e: Event) {
		e.preventDefault();
		if (submitting) return;
		submitting = true;
		try {
			if (newProviderType === 'cloudflare_access') {
				await api.post('/cloudflare-tokens', {
					name: newProviderName,
					clientId: newCfClientId,
					clientSecret: newCfClientSecret
				});
			} else {
				await api.post('/vps-providers', {
					name: newProviderName,
					type: newProviderType,
					apiKey: newProviderApiKey
				});
			}
			showAddModal = false;
			newProviderName = '';
			newProviderType = 'vultr';
			newProviderApiKey = '';
			newCfClientId = '';
			newCfClientSecret = '';
			toastStore.success('Provider connected');
			await invalidateAll();
		} catch (err: any) {
			toastStore.error(
				err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to connect provider'
			);
		} finally {
			submitting = false;
		}
	}

	async function handleDelete() {
		if (!providerToDelete?.id) return;
		const id = providerToDelete.id;
		const isCf = providerToDelete.deleteType === 'cloudflare_access';
		try {
			if (isCf) {
				await api.delete(`/cloudflare-tokens/${id}`);
			} else {
				await api.delete(`/vps-providers/${id}`);
			}
			toastStore.success('Provider disconnected');
			providerToDelete = null;
			await invalidateAll();
		} catch (err: any) {
			toastStore.error(
				err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to remove provider'
			);
		}
	}
</script>

<PageTitle title="Cloud Providers" />

<div class="space-y-6">
	<StickyHeader>
		<div class="flex items-center justify-between">
			<div class="flex flex-col gap-1">
				<h1 class="text-3xl font-bold tracking-tight">Cloud Providers</h1>
				<p class="text-muted-foreground">
					Manage multi-cloud credentials and upstream integrations.
				</p>
			</div>
			<Button onclick={() => (showAddModal = true)}>
				<Plus class="mr-2 size-4" />
				Add Provider
			</Button>
		</div>
	</StickyHeader>

	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each data.providers as provider}
			<div class="group relative block transition-transform hover:scale-[1.02]">
				<a
					href="/cloud-providers/{provider.id}"
					class="absolute inset-0 z-10"
					aria-label="View {provider.name}"
				></a>
				<Card.Root class="hover:border-primary/50 h-full">
					<Card.Header>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Cloud class="text-muted-foreground size-4" />
								<Card.Title class="text-lg">{provider.name}</Card.Title>
							</div>
							<div class="flex gap-2">
								{#if provider.dnsEnabled}
									<Badge variant="outline" class="border-green-500 bg-green-500/10 text-green-600"
										>DNS</Badge
									>
								{/if}
								<Badge variant="secondary">{provider.type}</Badge>
							</div>
						</div>
					</Card.Header>
					<Card.Content class="pb-4">
						<div class="grid grid-cols-4 gap-2">
							<div class="bg-muted/30 flex flex-col items-center rounded-lg p-2">
								<span class="text-lg font-bold">{provider.server_count || 0}</span>
								<span class="text-muted-foreground text-[10px] font-semibold uppercase"
									>Servers</span
								>
							</div>
							<div class="flex flex-col items-center rounded-lg bg-blue-500/5 p-2">
								<span class="text-lg font-bold text-blue-600 dark:text-blue-400"
									>{provider.application_count || 0}</span
								>
								<span
									class="text-[10px] font-semibold text-blue-600/70 uppercase dark:text-blue-400/70"
									>Apps</span
								>
							</div>
							<div class="flex flex-col items-center rounded-lg bg-purple-500/5 p-2">
								<span class="text-lg font-bold text-purple-600 dark:text-purple-400"
									>{provider.database_count || 0}</span
								>
								<span
									class="text-[10px] font-semibold text-purple-600/70 uppercase dark:text-purple-400/70"
									>DBs</span
								>
							</div>
							<div class="flex flex-col items-center rounded-lg bg-orange-500/5 p-2">
								<span class="text-lg font-bold text-orange-600 dark:text-orange-400"
									>{provider.domain_count || 0}</span
								>
								<span
									class="text-[10px] font-semibold text-orange-600/70 uppercase dark:text-orange-400/70"
									>Domains</span
								>
							</div>
						</div>
					</Card.Content>
					<Card.Footer class="pointer-events-none relative z-20 justify-between border-t pt-4">
						<div class="text-muted-foreground text-xs">
							Added {new Date(provider.createdAt).toLocaleDateString()}
						</div>
						<Button
							variant="ghost"
							size="sm"
							class="text-muted-foreground hover:text-destructive hover:bg-destructive/10 pointer-events-auto"
							onclick={() => (providerToDelete = { ...provider, deleteType: 'provider' })}
						>
							<Unplug class="size-4" />
						</Button>
					</Card.Footer>
				</Card.Root>
			</div>
		{:else}
			<div class="md:col-span-full py-12 text-center border-2 border-dashed rounded-lg">
				<p class="text-muted-foreground mb-8">No cloud providers connected.</p>

				<div class="max-w-2xl mx-auto px-4">
					<div
						class="relative overflow-hidden rounded-2xl bg-linear-to-br from-[#007bff]/10 to-[#6b47ff]/10 border border-[#007bff]/20 p-8 text-left"
					>
						<div
							class="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 size-64 bg-primary/10 rounded-full blur-3xl"
						></div>

						<div class="relative flex flex-col items-start gap-6">
							<div class="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4">
								<img
									src="/partners/vultr-logo.svg"
									alt="Vultr"
									class="h-8 w-auto dark:brightness-[10] dark:grayscale dark:contrast-200"
								/>
								<div
									class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#007bff] text-white text-[10px] font-bold uppercase tracking-wider h-fit"
								>
									Recommended Provider
								</div>
							</div>
							<div class="space-y-4">
								<h3 class="text-2xl font-bold tracking-tight">Get Started with Vultr</h3>
								<p class="text-muted-foreground text-sm leading-relaxed max-w-lg">
									Launch high-performance cloud servers in seconds. Choose an offer below to start
									your journey with the most reliable infrastructure partner.
								</p>
							</div>

							<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full pt-2">
								<!-- Option 1: Limited Deal -->
								<div
									class="bg-background/50 border border-[#007bff]/20 rounded-xl p-5 space-y-3 hover:border-[#007bff]/50 transition-colors"
								>
									<div class="text-[10px] font-bold text-[#007bff] uppercase tracking-tight">
										Best Value
									</div>
									<h4 class="font-bold text-lg leading-tight">$300 Free Credit</h4>
									<p class="text-[11px] text-muted-foreground leading-tight">
										Test drive the platform with a generous $300 credit (valid for 30 days).
									</p>
									<Button
										href="https://www.vultr.com/?ref=9634620-9J"
										target="_blank"
										rel="noopener noreferrer"
										size="sm"
										class="w-full bg-[#007bff] hover:bg-[#0069d9]"
									>
										Claim $300 Credit
									</Button>
								</div>

								<!-- Option 2: Standard Signup -->
								<div
									class="bg-background/50 border border-muted/50 rounded-xl p-5 space-y-3 hover:border-muted-foreground/50 transition-colors"
								>
									<div class="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
										Ongoing Offer
									</div>
									<h4 class="font-bold text-lg leading-tight">Standard Signup</h4>
									<p class="text-[11px] text-muted-foreground leading-tight">
										Simple signup for long-term production use without the 30-day pressure.
									</p>
									<Button
										href="https://www.vultr.com/?ref=7182700"
										target="_blank"
										rel="noopener noreferrer"
										variant="outline"
										size="sm"
										class="w-full"
									>
										Sign Up Normally
									</Button>
								</div>
							</div>
						</div>

						<div class="mt-8 pt-6 border-t border-[#007bff]/10">
							<p class="text-[9px] text-muted-foreground leading-relaxed italic space-y-2">
								<span class="block"
									><strong>Promotional Disclaimer:</strong> These are referral links. The standard link
									earns me $10 for every new unique paid user (active 30+ days, $10+ payment). The limited
									offer provides you with $300 credit (expires in 30 days) and earns me $100 if you stay
									active for 30+ days and spend $100+.</span
								>
								<span class="block"
									>Duplicate accounts not eligible. Valid credit card or PayPal required for $300
									credit eligibility. Payments verified before referral payouts.</span
								>
							</p>
						</div>
					</div>
				</div>
			</div>
		{/each}

		<!-- Cloudflare Access Tokens -->
		{#each data.cfTokens || [] as token}
			<div class="block transition-transform hover:scale-[1.02]">
				<Card.Root class="h-full border-orange-500/20 bg-orange-500/5 hover:border-orange-500/50">
					<Card.Header>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<ShieldCheck class="size-4 text-orange-600" />
								<Card.Title class="text-lg">{token.name}</Card.Title>
							</div>
							<Badge variant="outline" class="border-orange-500/30 text-orange-600"
								>Cloudflare Access</Badge
							>
						</div>
					</Card.Header>
					<Card.Content class="pb-4">
						<div class="space-y-2">
							<p class="text-muted-foreground line-clamp-2 text-xs">
								{token.description || 'Used for authenticating with Cloudflare Access Tunnels.'}
							</p>
							<div class="flex items-center gap-2 font-mono text-[10px] opacity-60">
								<span>Client ID: {token.clientId.slice(0, 8)}...</span>
							</div>
						</div>
					</Card.Content>
					<Card.Footer class="justify-between border-t pt-4">
						<div class="text-muted-foreground text-xs">
							Added {new Date(token.createdAt).toLocaleDateString()}
						</div>
						<Button
							variant="ghost"
							size="sm"
							class="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
							onclick={() => (providerToDelete = { ...token, deleteType: 'cloudflare_access' })}
						>
							<Unplug class="size-4" />
						</Button>
					</Card.Footer>
				</Card.Root>
			</div>
		{/each}
	</div>
</div>

<Dialog.Root bind:open={showAddModal}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Connect Provider</Dialog.Title>
			<Dialog.Description>Enable automated infrastructure synchronization.</Dialog.Description>
		</Dialog.Header>
		<form
			onsubmit={handleCreate}
			class="space-y-4 pt-4"
			autocomplete="off"
		>
			<div class="space-y-2">
				<Label for="name">Label</Label>
				<Input
					id="name"
					name="name"
					bind:value={newProviderName}
					placeholder="Vultr Account"
					required
				/>
			</div>
			<div class="space-y-2">
				<Label for="type">Platform</Label>
				<select
					id="type"
					name="type"
					bind:value={newProviderType}
					class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
				>
					<option value="vultr">Vultr</option>
					<option value="cloudflare_access">Cloudflare Access (Service Token)</option>
				</select>
			</div>

			{#if newProviderType === 'cloudflare_access'}
				<div class="space-y-2">
					<Label for="clientId">Client ID</Label>
					<Input
						id="clientId"
						name="clientId"
						bind:value={newCfClientId}
						placeholder="CF-Access-Client-Id"
						required
					/>
				</div>
				<div class="space-y-2">
					<Label for="clientSecret">Client Secret</Label>
					<Input
						id="clientSecret"
						name="clientSecret"
						type="password"
						bind:value={newCfClientSecret}
						placeholder="CF-Access-Client-Secret"
						required
					/>
				</div>
			{:else}
				<div class="space-y-2">
					<Label for="apiKey">API Key</Label>
					<Input
						id="apiKey"
						name="apiKey"
						type="password"
						bind:value={newProviderApiKey}
						placeholder="Your secret key"
						required
					/>
				</div>
			{/if}
			<Dialog.Footer>
				<Button type="submit" class="w-full" disabled={submitting}>
					{submitting ? 'Connecting…' : 'Connect Provider'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root
	open={!!providerToDelete}
	onOpenChange={(open) => !open && (providerToDelete = null)}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Disconnect Cloud Provider?</AlertDialog.Title>
			<AlertDialog.Description class="space-y-2">
				<p>
					Deleting this cloud provider profile only removes the connection to the API to that cloud
					provider.
				</p>
				<p class="text-foreground font-medium">
					It is non-destructive and it can be re-added at any time.
				</p>
				<p>
					Your servers and resources on {providerToDelete?.type ||
						(providerToDelete?.deleteType === 'cloudflare_access' ? 'Cloudflare' : '')} will NOT be deleted.
				</p>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				onclick={handleDelete}
			>
				Disconnect
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
