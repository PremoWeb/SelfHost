<script lang="ts">
	import { serversApi } from '$lib/api/resources/servers';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';

	import * as Tooltip from '$lib/components/ui/tooltip';
	import {
		Server,
		Box,
		Layers,
		Network,
		Cpu,
		ArrowRight,
		ArrowLeft,
		Check,
		Info,
		Monitor,
		ShieldCheck,
		Globe,
		HardDrive,
		KeyRound
	} from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import { badgeVariants } from '$lib/components/ui/badge';

	interface Props {
		privateKeys: any[];
		accessTokens?: any[];
		onClose: () => void;
	}

	let { privateKeys: privateKeysProp, accessTokens = [], onClose }: Props = $props();

	// Local state for managing keys (can be updated when generating new ones)
	let localPrivateKeys = $state<any[]>([]);
	
	// Initialize from prop once
	$effect(() => {
		const keys = privateKeysProp;
		if (localPrivateKeys.length === 0 && keys.length > 0) {
			localPrivateKeys = [...keys];
		}
	});

	// Wizard State
	let step = $state(1);
	let isCreating = $state(false);
	let isGeneratingKey = $state(false);

	// Data Models
	let envType = $state<'vps' | 'dedicated' | 'cluster' | null>(null);
	let infraTier = $state<'shared' | 'native' | 'container' | null>(null);
	let netMode = $state<'tunnel' | 'direct' | null>(null);
	let netProvider = $state<'cloudflare' | 'direct' | null>('direct');
	let tunnelProvider = $state<'cloudflare' | null>(null); // Tunnel provider (Cloudflare Argo, etc.)

	// Config Fields
	let name = $state('');
	let description = $state('');
	let ip = $state('');
	let port = $state(22);
	let user = $state('root');
	let privateKeyId = $state('');
	let rootPassword = $state(''); // For Proxmox/Password auth
	let osImage = $state('');
	let ram = $state('');
	let storage = $state('');

	// Cloudflare specific
	let cfHostname = $state('');
	let cfTokenId = $state('');
	let isProxmox = $state(false);

	// Step Titles
	const steps = [
		{ number: 1, title: 'Environment', icon: Server },
		{ number: 2, title: 'Infrastructure', icon: Layers },
		{ number: 3, title: 'Connectivity', icon: Network },
		{ number: 4, title: 'Configuration', icon: Cpu }
	];

	function nextStep() {
		if (step < 4) step++;
	}

	function prevStep() {
		if (step > 1) step--;
	}

	async function handleSubmit() {
		// Validate: Name is always required.
		// IP is required for direct mode, or for tunnel mode if no hostname is provided.
		// User is required.
		// Private Key is required unless Proxmox (where we might use password later).
		const needsIp = netMode === 'direct' || (netMode === 'tunnel' && tunnelProvider === 'cloudflare' && !cfHostname);
		if (!name || (needsIp && !ip) || !user || (!privateKeyId && !isProxmox)) {
			toastStore.error('Please fill in all required fields.');
			return;
		}

		isCreating = true;

		// Construct rich tags based on selection
		const tags: string[] = [];
		if (envType) tags.push(`env:${envType}`);
		if (infraTier) tags.push(`infra:${infraTier}`);
		if (netMode) tags.push(`net:${netMode}`);
		if (osImage) tags.push(`os:${osImage.toLowerCase()}`);
		if (ram) tags.push(`ram:${ram}`);
		if (storage) tags.push(`storage:${storage}`);

		// Add proxmox tag if selected
		if (isProxmox) tags.push('proxmox');

		// Add implicit Cloudflare tag if using that provider
		if (netProvider === 'cloudflare' || (netMode === 'tunnel' && tunnelProvider === 'cloudflare')) {
			tags.push('provider:cloudflare');
		}

		try {
			const response = await serversApi.create({
				name,
				description,
				ip: netMode === 'tunnel' && cfHostname 
					? (ip || '127.0.0.1') // Use provided IP or fallback for tunnel with hostname
					: ip, // Use IP for direct mode or tunnel without hostname
				port,
				user,
				private_key_id: Number(privateKeyId),
				tags,
				cloudflare_tunnel_hostname: cfHostname || null,
				cloudflare_access_token_id: cfTokenId || null
			});
			
			const server = response.data?.data;
			
			// Show success immediately after server creation
			toastStore.success('Server Registered Successfully');
			
			// Invalidate page data to refresh the server list
			await invalidateAll();
			
			// Close the wizard immediately
			onClose();
			
			// If Proxmox server with password and private key, install the key in the background
			if (isProxmox && rootPassword && privateKeyId && server?.id) {
				// Don't await - let it run in the background
				(async () => {
					try {
						// Add a timeout to prevent hanging (30 seconds should be enough)
						const timeoutPromise = new Promise<never>((_, reject) => 
							setTimeout(() => reject(new Error('Key installation timed out after 30 seconds')), 30000)
						);
						
						const installPromise = api.post<{ data: { success: boolean; message: string; privateKeyId?: string } }>(
							`/servers/${server.id}/install-key`,
							{
								password: rootPassword,
								keyId: privateKeyId
							}
						);
						
						const installResponse = await Promise.race([installPromise, timeoutPromise]);
						
						if (installResponse.data?.data?.success) {
							toastStore.success('SSH access key installed successfully');
							await invalidateAll(); // Refresh to show the updated key
						} else {
							toastStore.warning('SSH key installation failed. You may need to install it manually.');
						}
					} catch (installError: any) {
						// Key installation failed, but server was already created
						toastStore.warning(
							installError.response?.data?.message || installError.message ||
							'SSH key installation failed. You may need to install it manually.'
						);
					}
				})();
			}
		} catch (error: any) {
			console.error('Server registration error:', error);
			toastStore.error(error.response?.data?.message || error.message || 'Failed to register server');
		} finally {
			isCreating = false;
		}
	}

	async function handleGenerateAndCreateKey() {
		if (!name?.trim()) {
			toastStore.error('Please enter a server name first');
			return;
		}

		isGeneratingKey = true;
		const toastId = toastStore.loading('Generating SSH key...');

		try {
			// Step 1: Generate the key pair
			const generateResponse = await fetch('/api/security/private-key/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			if (!generateResponse.ok) {
				throw new Error('Failed to generate key pair');
			}

			const { data: keyPair } = await generateResponse.json();

			// Step 2: Create the key in the system
			const createResponse = await fetch('/api/security/private-key', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: `Auto-generated for ${name}`,
					description: `Automatically generated key for server: ${name}`,
					privateKey: keyPair.privateKey
				})
			});

			if (!createResponse.ok) {
				const error = await createResponse.json();
				throw new Error(error.message || 'Failed to create key');
			}

			const { data: newKey } = await createResponse.json();

			// Step 3: Add to local list and select it
			localPrivateKeys = [...localPrivateKeys, newKey];
			privateKeyId = String(newKey.id);

			toastStore.remove(toastId);
			toastStore.success('SSH key generated and selected');
		} catch (error: any) {
			toastStore.remove(toastId);
			toastStore.error(error.message || 'Failed to generate SSH key');
		} finally {
			isGeneratingKey = false;
		}
	}

	async function handleTestConnection() {
		// Basic validation for test
		if ((!ip && netMode === 'direct') || !user) {
			toastStore.error('Host/IP and User are required for testing.');
			return;
		}
		if (netMode === 'tunnel' && !cfHostname) {
			toastStore.error('Tunnel Hostname required for testing.');
			return;
		}
		if (isProxmox && !rootPassword) {
			toastStore.error('Password is required for Proxmox connection test.');
			return;
		}

		const toastId = toastStore.loading('Testing connection...');

		try {
			const response = await fetch('/api/servers/test-connection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					ip: netMode === 'tunnel' ? '127.0.0.1' : ip, // dummy IP for tunnel, logic handled by backend
					port,
					user,
					password: isProxmox ? rootPassword : null,
					privateKeyId: !isProxmox ? privateKeyId : null,
					cloudflareTunnelHostname: netMode === 'tunnel' ? cfHostname : null,
					cloudflareAccessTokenId: netMode === 'tunnel' ? cfTokenId : null
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				toastStore.remove(toastId);
				toastStore.error(`Connection test failed: ${response.status} ${response.statusText}`);
				return;
			}

			const result = await response.json();

			// Remove the loading toast
			toastStore.remove(toastId);

			if (result.success) {
				toastStore.success('Connection Successful!');
			} else {
				toastStore.error(`Connection Failed: ${result.message || 'Unknown error'}`);
			}
		} catch (error: any) {
			// Remove the loading toast
			toastStore.remove(toastId);
			toastStore.error(`Failed to initiate test: ${error.message || 'Network error'}`);
		}
	}
</script>

<div class="flex h-full flex-col">
	<!-- Wizard Header -->
	<div class="border-b px-6 py-4">
		<div class="mb-4 flex items-center justify-between">
			<div class="space-y-1">
				<h2 class="text-xl font-bold tracking-tight">Add Server</h2>
				<p class="text-muted-foreground text-sm">Follow the steps to register a new node.</p>
			</div>
			<div class="text-muted-foreground text-sm font-medium">Step {step} of 4</div>
		</div>

		<!-- Progress Bar -->
		<div class="flex items-center gap-2">
			{#each steps as s}
				<div class="flex flex-1 flex-col gap-2">
					<div
						class={cn(
							'h-1 w-full rounded-full transition-all duration-500',
							step >= s.number ? 'bg-primary' : 'bg-muted'
						)}
					></div>
					<div
						class={cn(
							'text-[10px] font-bold uppercase transition-colors duration-500',
							step >= s.number ? 'text-primary' : 'text-muted-foreground'
						)}
					>
						{s.title}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Wizard Content -->
	<div class="flex-1 overflow-y-auto p-6">
		{#if step === 1}
			<div class="space-y-6">
				<div class="space-y-2">
					<h3 class="text-lg font-medium">Choose your compute foundation</h3>
					<p class="text-muted-foreground text-sm">What type of environment is this server?</p>
				</div>
				<div class="grid gap-4 md:grid-cols-3">
					<button
						class={cn(
							'hover:border-primary/50 hover:bg-muted/50 flex flex-col items-center gap-4 rounded-xl border-2 p-6 text-center transition-all',
							envType === 'vps' ? 'border-primary bg-primary/5' : 'border-border bg-card'
						)}
						onclick={() => (envType = 'vps')}
					>
						<div class="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
							<Server class="size-8 text-blue-600 dark:text-blue-400" />
						</div>
						<div class="space-y-1">
							<div class="font-bold">Virtual Private Server</div>
							<div class="text-muted-foreground text-xs">Shared virtual machine</div>
						</div>
					</button>
					<button
						class={cn(
							'hover:border-primary/50 hover:bg-muted/50 flex flex-col items-center gap-4 rounded-xl border-2 p-6 text-center transition-all',
							envType === 'dedicated' ? 'border-primary bg-primary/5' : 'border-border bg-card'
						)}
						onclick={() => (envType = 'dedicated')}
					>
						<div class="rounded-full bg-purple-100 p-3 dark:bg-purple-900/30">
							<HardDrive class="size-8 text-purple-600 dark:text-purple-400" />
						</div>
						<div class="space-y-1">
							<div class="font-bold">Dedicated Server</div>
							<div class="text-muted-foreground text-xs">Bare-metal hardware</div>
						</div>
					</button>
					<button
						class={cn(
							'hover:border-primary/50 hover:bg-muted/50 flex flex-col items-center gap-4 rounded-xl border-2 p-6 text-center transition-all',
							envType === 'cluster' ? 'border-primary bg-primary/5' : 'border-border bg-card'
						)}
						onclick={() => (envType = 'cluster')}
					>
						<div class="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
							<Layers class="size-8 text-green-600 dark:text-green-400" />
						</div>
						<div class="space-y-1">
							<div class="font-bold">Compute Cluster</div>
							<div class="text-muted-foreground text-xs">High availability group</div>
						</div>
					</button>
				</div>

				<div class="text-muted-foreground space-y-4 pt-4 text-sm">
					<p>
						<strong class="text-primary mb-1 block font-medium">Virtual Private Server (VPS)</strong
						>
						Standard virtual machines sharing hardware resources. Best for general purpose web hosting,
						development environments, and cost-effective scaling.
					</p>
					<p>
						<strong class="text-primary mb-1 block font-medium">Dedicated Server</strong>
						Full physical servers dedicated to one user. Ideal for high-performance databases, AI/ML workloads,
						and latency-sensitive game servers requiring direct hardware access.
					</p>
					<p>
						<strong class="text-primary mb-1 block font-medium">Compute Cluster</strong>
						Grouped instances for high availability or scaling. Used for orchestrated container environments
						like Kubernetes or Docker Swarm to ensure redundancy.
					</p>
				</div>
			</div>
		{:else if step === 2}
			<div class="space-y-6">
				<div class="space-y-2">
					<h3 class="text-lg font-medium">Virtualization Engine</h3>
					<p class="text-muted-foreground text-sm">
						Select the infrastructure tier running on the host.
					</p>
				</div>

				<div class="grid gap-4">
					{#if envType === 'dedicated'}
						<button
							class={cn(
								'flex items-center gap-4 rounded-lg border p-4 text-left transition-all',
								infraTier === 'native'
									? 'border-primary bg-primary/5 ring-primary ring-1'
									: 'hover:bg-muted/50'
							)}
							onclick={() => (infraTier = 'native')}
						>
							<div class="bg-primary/10 rounded-full p-2">
								<Cpu class="text-primary size-6" />
							</div>
							<div class="flex-1">
								<div class="font-bold">Native / Bare-Metal</div>
								<div class="text-muted-foreground text-sm">
									No hypervisor. Direct hardware access.
								</div>
							</div>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<Info class="text-muted-foreground/50 size-4" />
								</Tooltip.Trigger>
								<Tooltip.Content>
									<p>Standard Term: Bare-Metal</p>
									<p>Use Case: Production, Databases</p>
								</Tooltip.Content>
							</Tooltip.Root>
						</button>
					{/if}

					<!-- Proxmox Option -->
					<button
						class={cn(
							'flex items-center gap-4 rounded-lg border p-4 text-left transition-all',
							isProxmox
								? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500 dark:bg-orange-950/20'
								: 'hover:bg-muted/50'
						)}
						onclick={() => {
							infraTier = 'shared';
							isProxmox = true;
						}}
					>
						<div class="rounded-full bg-orange-100 p-2 dark:bg-orange-900/30">
							<Layers class="size-6 text-orange-600 dark:text-orange-400" />
						</div>
						<div class="flex-1">
							<div class="font-bold">Proxmox Environment</div>
							<div class="text-muted-foreground text-sm">LXC Container or Virtual Machine (VM)</div>
						</div>
					</button>

					<button
						class={cn(
							'flex items-center gap-4 rounded-lg border p-4 text-left transition-all',
							infraTier === 'shared' && !isProxmox
								? 'border-primary bg-primary/5 ring-primary ring-1'
								: 'hover:bg-muted/50'
						)}
						onclick={() => {
							infraTier = 'shared';
							isProxmox = false;
						}}
					>
						<div class="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
							<Monitor class="size-6 text-blue-600 dark:text-blue-400" />
						</div>
						<div class="flex-1">
							<div class="font-bold">
								{envType === 'dedicated' ? 'Type-1 Hypervisor' : 'Standard VPS'}
							</div>
							<div class="text-muted-foreground text-sm">
								{envType === 'dedicated' ? 'ESXi, Xen' : 'KVM, DigitalOcean, Linode, AWS'}
							</div>
						</div>
					</button>

					<button
						class={cn(
							'flex items-center gap-4 rounded-lg border p-4 text-left transition-all',
							infraTier === 'container'
								? 'border-primary bg-primary/5 ring-primary ring-1'
								: 'hover:bg-muted/50'
						)}
						onclick={() => {
							infraTier = 'container';
							isProxmox = false;
						}}
					>
						<div class="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
							<Box class="size-6 text-blue-600 dark:text-blue-400" />
						</div>
						<div class="flex-1">
							<div class="font-bold">Containerized</div>
							<div class="text-muted-foreground text-sm">Docker, Podman (Not Proxmox)</div>
						</div>
					</button>
				</div>
			</div>
		{:else if step === 3}
			<div class="space-y-6">
				<div class="space-y-2">
					<h3 class="text-lg font-medium">Connectivity Model</h3>
					<p class="text-muted-foreground text-sm">How should traffic reach this server?</p>
				</div>

				<div class="grid gap-4 md:grid-cols-2">
					<button
						class={cn(
							'hover:border-primary/50 hover:bg-muted/50 flex flex-col items-center gap-4 rounded-xl border-2 p-6 text-center transition-all',
							netMode === 'tunnel' ? 'border-primary bg-primary/5' : 'border-border bg-card'
						)}
						onclick={() => {
							netMode = 'tunnel';
							tunnelProvider = null; // Reset tunnel provider when selecting tunnel mode
						}}
					>
						<div class="rounded-full bg-orange-100 p-3 dark:bg-orange-900/30">
							<ShieldCheck class="size-8 text-orange-600 dark:text-orange-400" />
						</div>
						<div class="space-y-1">
							<div class="font-bold">Secure Tunnel</div>
							<div class="text-muted-foreground text-xs">Stealth Mode (No Public IP)</div>
						</div>
						<div class="bg-muted rounded px-2 py-1 text-xs">Best for Private Networks</div>
					</button>

					<button
						class={cn(
							'hover:border-primary/50 hover:bg-muted/50 flex flex-col items-center gap-4 rounded-xl border-2 p-6 text-center transition-all',
							netMode === 'direct' ? 'border-primary bg-primary/5' : 'border-border bg-card'
						)}
						onclick={() => {
							netMode = 'direct';
						}}
					>
						<div class="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
							<Globe class="size-8 text-blue-600 dark:text-blue-400" />
						</div>
						<div class="space-y-1">
							<div class="font-bold">Direct Access</div>
							<div class="text-muted-foreground text-xs">Public IP Address</div>
						</div>
					</button>
				</div>

				{#if netMode === 'tunnel'}
					<div class="space-y-4 pt-4">
						<div class="space-y-2">
							<Label>Tunnel Provider</Label>
							<p class="text-muted-foreground text-xs">
								Select the tunnel service you're using to connect to this server.
							</p>
						</div>
						<div class="grid gap-4 md:grid-cols-2">
							<button
								class={cn(
									'flex flex-col items-center gap-3 rounded-lg border p-4 text-center transition-all',
									tunnelProvider === 'cloudflare'
										? 'border-primary bg-primary/5 ring-primary ring-1'
										: 'hover:bg-muted/50 border-border'
								)}
								onclick={() => {
									tunnelProvider = 'cloudflare';
									netProvider = 'cloudflare';
								}}
							>
								<div class="rounded-full bg-orange-100 p-2 dark:bg-orange-900/30">
									<ShieldCheck class="size-6 text-orange-600 dark:text-orange-400" />
								</div>
								<div class="space-y-1">
									<div class="font-bold text-sm">Cloudflare Argo</div>
									<div class="text-muted-foreground text-[10px]">Cloudflare Tunnel</div>
								</div>
							</button>
							<!-- Placeholder for future tunnel providers -->
							<div
								class="flex flex-col items-center gap-3 rounded-lg border border-dashed p-4 text-center opacity-50"
							>
								<div class="rounded-full bg-muted p-2">
									<Network class="size-6 text-muted-foreground" />
								</div>
								<div class="space-y-1">
									<div class="font-bold text-sm text-muted-foreground">More Providers</div>
									<div class="text-muted-foreground text-[10px]">Coming Soon</div>
								</div>
							</div>
						</div>

						{#if tunnelProvider === 'cloudflare'}
							<div
								class="space-y-4 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/30 dark:bg-orange-950/20"
							>
								<div
									class="flex items-center justify-between text-sm font-bold text-orange-700 dark:text-orange-400"
								>
									<div class="flex items-center gap-2">
										<ShieldCheck class="size-4" />
										Cloudflare Argo Tunnel Configuration
									</div>
									<a
										href="/docs/cloudflare"
										target="_blank"
										class="text-xs underline hover:text-orange-900 dark:hover:text-orange-300"
										onclick={(e) => {
											e.stopPropagation();
										}}
									>
										Learn more →
									</a>
								</div>
								<div class="space-y-3">
									<div class="space-y-1">
										<Label for="cfHostname" class="text-xs">Tunnel Hostname</Label>
										<Input
											id="cfHostname"
											bind:value={cfHostname}
											placeholder="ssh.example.com"
											class="bg-background"
										/>
										<p class="text-muted-foreground text-[10px]">
											The Cloudflare Access hostname configured for SSH access.
										</p>
									</div>
									{#if accessTokens.length > 0}
										<div class="space-y-1">
											<Label for="cfToken" class="text-xs">Service Token (Recommended)</Label>
											<select
												id="cfToken"
												bind:value={cfTokenId}
												class="bg-background border-input flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm"
											>
												<option value="">Select Token...</option>
												{#each accessTokens as token}
													<option value={token.id}>{token.name}</option>
												{/each}
											</select>
											<p class="text-muted-foreground text-[10px]">
												Service token for authenticating with Cloudflare Access.
											</p>
										</div>
									{:else}
										<div
											class="rounded bg-yellow-50 p-2 text-[10px] text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
										>
											<p class="font-semibold">No Service Tokens found.</p>
											<p>
												Most tunnels require authentication. You can add tokens in <a
													href="/settings"
													class="underline hover:text-yellow-950"
													onclick={(e) => {
														e.preventDefault();
														goto('/settings');
													}}>Settings</a
												>.
											</p>
										</div>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				{:else if netMode === 'direct'}
					<div class="space-y-4 pt-2">
						<Label>Network Provider</Label>
						<div class="flex gap-4">
							<button
								class={cn(
									'flex flex-1 items-center gap-2 rounded-lg border p-3 text-sm transition-all',
									netProvider === 'direct' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
								)}
								onclick={() => (netProvider = 'direct')}
							>
								<div class="size-2 rounded-full bg-green-500"></div>
								Direct DNS
							</button>
							<button
								class={cn(
									'flex flex-1 items-center gap-2 rounded-lg border p-3 text-sm transition-all',
									netProvider === 'cloudflare' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
								)}
								onclick={() => (netProvider = 'cloudflare')}
							>
								<div class="size-2 rounded-full bg-orange-500"></div>
								Cloudflare Proxy
							</button>
						</div>
					</div>
				{/if}
			</div>
		{:else if step === 4}
			<div class="space-y-6">
				<div class="space-y-2">
					<h3 class="text-lg font-medium">Configuration Baselines</h3>
					<p class="text-muted-foreground text-sm">Define identity and access credentials.</p>
				</div>

				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="name">Server Name</Label>
						<Input id="name" bind:value={name} placeholder="e.g. prod-web-01" />
					</div>

					{#if !isProxmox}
						<div class="space-y-2">
							<Label for="osImage">OS Image</Label>
							<select
								id="osImage"
								bind:value={osImage}
								class="bg-background border-input flex h-10 w-full rounded-md border px-3 py-1 text-sm shadow-sm"
							>
								<option value="">Select OS...</option>
								<option value="ubuntu">Ubuntu 22.04 LTS</option>
								<option value="debian">Debian 12</option>
								<option value="alpine">Alpine Linux</option>
								<option value="rocky">Rocky Linux</option>
							</select>
						</div>
					{/if}

					{#if netMode === 'direct'}
						<div class="space-y-2 md:col-span-2">
							<Label for="ip">Public IPv4 Address</Label>
							<Input id="ip" bind:value={ip} placeholder="1.2.3.4" />
						</div>
					{:else if netMode === 'tunnel' && tunnelProvider === 'cloudflare' && !cfHostname}
						<div class="space-y-2 md:col-span-2">
							<Label for="ip">Server IP Address (Fallback)</Label>
							<Input id="ip" bind:value={ip} placeholder="1.2.3.4" />
							<p class="text-muted-foreground text-[10px]">
								Since no tunnel hostname was provided, you can enter the server's IP address for direct connection.
								Alternatively, go back to step 3 to configure a Cloudflare Tunnel hostname.
							</p>
						</div>
					{/if}

					<div class="space-y-2">
						<Label for="user">SSH User</Label>
						<Input id="user" bind:value={user} placeholder="root" />
					</div>
					<div class="space-y-2">
						<Label for="port">SSH Port</Label>
						<Input id="port" type="number" bind:value={port} />
					</div>
				</div>

				{#if isProxmox}
					<div class="mt-2 space-y-2 border-l-2 border-orange-200 py-2 pl-4">
						<Label for="password">Root Password</Label>
						<div class="flex gap-2">
							<Input
								id="password"
								type="password"
								bind:value={rootPassword}
								placeholder="Enter root password..."
							/>
							<Button variant="outline" onclick={handleTestConnection}>Test Access</Button>
						</div>
						<p class="text-muted-foreground text-[10px]">
							Used to verify access and install agent. Password is not stored permanently.
						</p>
					</div>
				{/if}

				{#if !isProxmox}
					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="ram">RAM</Label>
							<Input id="ram" bind:value={ram} placeholder="e.g. 8GB" />
						</div>
						<div class="space-y-2">
							<Label for="storage">Storage</Label>
							<Input id="storage" bind:value={storage} placeholder="e.g. 100GB NVMe" />
						</div>
					</div>
				{/if}

				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<Label for="pk">SSH Access Key {isProxmox ? '(Optional)' : ''}</Label>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={handleGenerateAndCreateKey}
							disabled={isGeneratingKey || !name?.trim()}
						>
							{#if isGeneratingKey}
								<span
									class="mr-2 size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
								></span>
							{:else}
								<KeyRound class="mr-2 size-3" />
							{/if}
							Generate & Install Key
						</Button>
					</div>
					<select
						id="pk"
						bind:value={privateKeyId}
						class="bg-background border-input flex h-10 w-full rounded-md border px-3 py-1 text-sm shadow-sm"
					>
						<option value=""
							>{isProxmox ? 'Auto-generate / Use Password' : 'Select SSH Access Key...'}</option
						>
						{#each localPrivateKeys as pk}
							<option value={pk.id}>{pk.name}</option>
						{/each}
					</select>
					<p class="text-muted-foreground text-[10px]">
						{isProxmox
							? 'If skipped, we will attempt to install a new key using the password provided.'
							: 'Required for server maintenance and SelfHost agent installation.'}
					</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Wizard Footer -->
	<div class="bg-muted/20 border-t px-6 py-4">
		<div class="flex items-center justify-between">
			{#if step > 1}
				<Button variant="outline" onclick={prevStep}>
					<ArrowLeft class="mr-2 size-4" />
					Back
				</Button>
			{:else}
				<div></div>
			{/if}

			{#if step < 4}
				<Button
					onclick={nextStep}
					disabled={(step === 1 && !envType) ||
						(step === 2 && !infraTier) ||
						(step === 3 && (!netMode || (netMode === 'tunnel' && !tunnelProvider)))}
				>
					Next Step
					<ArrowRight class="ml-2 size-4" />
				</Button>
			{:else}
				<Button onclick={handleSubmit} disabled={isCreating}>
					{isCreating ? 'Registering...' : 'Complete Setup'}
					{#if !isCreating}
						<Check class="ml-2 size-4" />
					{/if}
				</Button>
			{/if}
		</div>
	</div>
</div>
