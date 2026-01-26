<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { page as pageStore } from '$app/stores';
	import { getServerStatus } from './(app)/servers.remote';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import * as Dialog from '$lib/components/ui/dialog';
	import {
		Server,
		LayoutGrid,
		Rocket,
		Activity,
		ChevronRight,
		ArrowUpRight,
		Cpu,
		Database,
		Globe,
		ArrowRight,
		Zap,
		Shield,
		Code2
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import type { PageData } from './$types';
	import OnboardingChecklist from '$lib/components/OnboardingChecklist.svelte';
	import AddKeyForm from '$lib/components/security/AddKeyForm.svelte';
	import RegisterServerForm from '$lib/components/servers/RegisterServerForm.svelte';
	import ServerGlobe from '$lib/components/dashboard/ServerGlobe.svelte';

	let { data }: { data: PageData } = $props();
	
	// Check if we should show landing page
	const shouldShowLanding = $derived((data as any)?.shouldShowLanding || false);

	// Modal state for shallow routing
	let onboardingModalOpen = $state(false);

	$effect(() => {
		if (page.state.onboardingStep) {
			onboardingModalOpen = true;
		} else {
			onboardingModalOpen = false;
		}
	});

	function handleModalOpenChange(open: boolean) {
		if (!open) {
			history.back();
		}
	}

	async function handleSuccess() {
		await invalidateAll();
		history.back();
	}

	// Get context info from page data (includes layout data)
	const contextData = $derived(data as any);

	// Polling for health data on dashboard
	let serverUpdates = $state<Record<string, any>>({});
	let servers = $derived((data as any)?.servers?.map((s: any) => serverUpdates[s.id] ?? s) || []);

	$effect(() => {
		if (shouldShowLanding) return;
		
		const interval = setInterval(async () => {
			try {
				for (const s of servers) {
					if (s.connectionType === 'agent') {
						const response = await getServerStatus({ serverId: s.id });
						if (response.success && response.data) {
							serverUpdates[s.id] = response.data;
						}
					}
				}
			} catch (err) {}
		}, 8000); // Poll slower on dashboard

		return () => clearInterval(interval);
	});

	const checks = [
		{ label: 'SelfHost API Gateway', status: 'Online', icon: Globe },
		{ label: 'Primary DB Cluster', status: 'Online', icon: Database },
		{ label: 'SelfHost Cloud Agent', status: 'Online', icon: Activity }
	];
</script>

{#if shouldShowLanding}
	<!-- Landing Page Content -->
	<div class="min-h-screen bg-gradient-to-b from-background to-muted/20">
		<!-- Hero Section -->
		<section class="container mx-auto px-4 py-20 text-center">
			<div class="mx-auto max-w-4xl">
				<h1 class="mb-6 text-5xl font-bold tracking-tight md:text-6xl">
					Self-Hosting for the
					<span class="text-primary">Greater Good</span>
				</h1>
				<p class="text-muted-foreground mb-8 text-xl md:text-2xl">
					Take control of your infrastructure with a modern, open-source deployment platform.
					Deploy, manage, and scale your applications on your own servers.
				</p>
				<div class="flex flex-col gap-4 sm:flex-row sm:justify-center">
					<Button size="lg" onclick={() => goto('/docs')}>
						Get Started
						<ArrowRight class="ml-2 size-4" />
					</Button>
					<Button size="lg" variant="outline" onclick={() => goto('/docs')}>
						View Documentation
					</Button>
				</div>
			</div>
		</section>

		<!-- Features Section -->
		<section class="container mx-auto px-4 py-20">
			<div class="mx-auto max-w-6xl">
				<h2 class="mb-12 text-center text-3xl font-bold">Why SelfHost?</h2>
				<div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
					<div class="rounded-lg border bg-card p-6">
						<Server class="text-primary mb-4 size-8" />
						<h3 class="mb-2 text-xl font-semibold">Full Control</h3>
						<p class="text-muted-foreground">
							Your data, your servers, your rules. No vendor lock-in, no platform tax.
						</p>
					</div>
					<div class="rounded-lg border bg-card p-6">
						<Zap class="text-primary mb-4 size-8" />
						<h3 class="mb-2 text-xl font-semibold">Lightning Fast</h3>
						<p class="text-muted-foreground">
							Built with SvelteKit for real-time responsiveness and superior performance.
						</p>
					</div>
					<div class="rounded-lg border bg-card p-6">
						<Shield class="text-primary mb-4 size-8" />
						<h3 class="mb-2 text-xl font-semibold">Secure by Default</h3>
						<p class="text-muted-foreground">
							Industry-standard encryption, SSH key management, and comprehensive audit logging.
						</p>
					</div>
					<div class="rounded-lg border bg-card p-6">
						<Code2 class="text-primary mb-4 size-8" />
						<h3 class="mb-2 text-xl font-semibold">Developer Friendly</h3>
						<p class="text-muted-foreground">
							Git-based deployments, environment variables, and seamless CI/CD integration.
						</p>
					</div>
					<div class="rounded-lg border bg-card p-6">
						<Database class="text-primary mb-4 size-8" />
						<h3 class="mb-2 text-xl font-semibold">Multi-Tenant</h3>
						<p class="text-muted-foreground">
							Built-in support for teams, companies, and resource sharing across your organization.
						</p>
					</div>
					<div class="rounded-lg border bg-card p-6">
						<Globe class="text-primary mb-4 size-8" />
						<h3 class="mb-2 text-xl font-semibold">Cloud Agnostic</h3>
						<p class="text-muted-foreground">
							Works with any cloud provider or your own bare metal. No vendor lock-in.
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- CTA Section -->
		<section class="container mx-auto px-4 py-20">
			<div class="mx-auto max-w-4xl rounded-lg border bg-card p-12 text-center">
				<h2 class="mb-4 text-3xl font-bold">Ready to Get Started?</h2>
				<p class="text-muted-foreground mb-8 text-lg">
					Join the self-hosting revolution. Deploy your first application in minutes.
				</p>
				<div class="flex flex-col gap-4 sm:flex-row sm:justify-center">
					<Button size="lg" onclick={() => goto('/register')}>
						Create Account
						<ArrowRight class="ml-2 size-4" />
					</Button>
					<Button size="lg" variant="outline" onclick={() => goto('/docs')}>
						Read the Docs
					</Button>
				</div>
			</div>
		</section>
	</div>
{:else}
	<!-- Dashboard Content -->
	<div class="space-y-8">
		{#if $authStore.isLoading}
			<div class="flex items-center justify-center py-20">
				<span class="text-muted-foreground text-sm">Loading...</span>
			</div>
		{:else if $authStore.isAuthenticated}
			<div class="flex flex-col gap-3">
				<div class="flex items-center justify-between">
					<div class="flex flex-col gap-1">
						<h1 class="text-3xl font-bold tracking-tight">
							Welcome back{contextData?.user?.name ? `, ${contextData.user.name}` : ''}!
						</h1>
						{#if contextData?.isImpersonating && contextData?.impersonationType}
							<div class="flex items-center gap-2">
								{#if contextData.impersonationType === 'team' && contextData.team}
									<p class="text-muted-foreground">
										Viewing as <strong class="text-foreground">Team: {contextData.team.name}</strong>
									</p>
								{:else if contextData.impersonationType === 'company' && contextData.activeCompany}
									<p class="text-muted-foreground">
										Viewing as <strong class="text-foreground"
											>Company: {contextData.activeCompany.name}</strong
										>
									</p>
								{:else if contextData.impersonationType === 'user'}
									<p class="text-muted-foreground">
										Viewing as <strong class="text-foreground"
											>User: {contextData.user?.name || contextData.user?.email}</strong
										>
									</p>
								{/if}
								<Badge variant="outline" class="text-xs">Impersonating</Badge>
							</div>
						{:else if contextData?.activeCompany}
							<p class="text-muted-foreground">
								Managing <strong class="text-foreground"
									>Company: {contextData.activeCompany.name}</strong
								>
							</p>
						{:else if contextData?.team}
							<p class="text-muted-foreground">
								Managing <strong class="text-foreground">Team: {contextData.team.name}</strong>
							</p>
						{:else if contextData?.isGod}
							<p class="text-muted-foreground">
								<strong class="text-foreground">God Mode</strong> - No active context
							</p>
						{:else}
							<p class="text-muted-foreground">No active context selected</p>
						{/if}
					</div>
				</div>
			</div>

			<OnboardingChecklist stats={(data as any)?.stats || { projects: 0, servers: 0, deployments: 0, keys: 0, sources: 0 }} />

			<ServerGlobe {servers} />

			<div class="grid gap-4 md:grid-cols-3">
				<Card.Root class="bg-primary/5 border-primary/10">
					<Card.Header
						class="text-muted-foreground flex flex-row items-center justify-between space-y-0 pb-2"
					>
						<Card.Title class="text-[10px] font-bold tracking-wider uppercase"
							>Total Projects</Card.Title
						>
						<LayoutGrid class="text-primary size-4" />
					</Card.Header>
					<Card.Content>
						<div class="text-3xl font-bold">{(data as any)?.stats?.projects || 0}</div>
					</Card.Content>
				</Card.Root>
				<Card.Root class="bg-primary/5 border-primary/10">
					<Card.Header
						class="text-muted-foreground flex flex-row items-center justify-between space-y-0 pb-2"
					>
						<Card.Title class="text-[10px] font-bold tracking-wider uppercase"
							>Managed Servers</Card.Title
						>
						<Server class="text-primary size-4" />
					</Card.Header>
					<Card.Content>
						<div class="text-3xl font-bold">{(data as any)?.stats?.servers || 0}</div>
					</Card.Content>
				</Card.Root>
				<Card.Root class="bg-primary/5 border-primary/10">
					<Card.Header
						class="text-muted-foreground flex flex-row items-center justify-between space-y-0 pb-2"
					>
						<Card.Title class="text-[10px] font-bold tracking-wider uppercase">Deployments</Card.Title
						>
						<Rocket class="text-primary size-4" />
					</Card.Header>
					<Card.Content>
						<div class="text-3xl font-bold">{(data as any)?.stats?.deployments || 0}</div>
					</Card.Content>
				</Card.Root>
			</div>

			<div class="grid gap-6 lg:grid-cols-3">
				<!-- Server Health Section -->
				<div class="space-y-4 lg:col-span-2">
					<div class="flex items-center justify-between">
						<h2 class="flex items-center gap-2 text-lg font-semibold">
							<Activity class="text-primary size-5" />
							Live Infrastructure
						</h2>
						<a href="/servers" class="text-primary flex items-center text-xs hover:underline">
							View all <ChevronRight class="size-3" />
						</a>
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						{#each servers as server}
							{@const Icon = server.connectionType === 'agent' ? Activity : Server}
							<Card.Root class="border-muted-foreground/10 overflow-hidden">
								<Card.Header class="p-4 pb-2">
									<div class="flex items-center justify-between gap-4">
										<div class="flex items-center gap-2 overflow-hidden">
											<Icon class="text-primary size-4" />
											<Card.Title class="truncate text-sm">{server.name}</Card.Title>
										</div>
										<Badge
											variant="outline"
											class={server.status === 'online'
												? 'border-green-200 text-green-600'
												: 'text-muted-foreground'}
										>
											{server.status}
										</Badge>
									</div>
								</Card.Header>
								<Card.Content class="space-y-4 p-4 pt-0">
									<span class="text-muted-foreground font-mono text-[10px]">{server.ip}</span>

									<div class="grid grid-cols-2 gap-3">
										<div class="space-y-1">
											<div class="text-muted-foreground flex justify-between text-[10px] uppercase">
												<span class="flex items-center gap-1"><Cpu class="size-2.5" /> CPU</span>
												<span>{server.healthCpu || 0}%</span>
											</div>
											<div class="bg-muted h-1 w-full overflow-hidden rounded-full">
												<div
													class="bg-primary h-full transition-all duration-500"
													style="width: {server.healthCpu || 0}%"
												></div>
											</div>
										</div>
										<div class="space-y-1">
											<div class="text-muted-foreground flex justify-between text-[10px] uppercase">
												<span class="flex items-center gap-1"><Database class="size-2.5" /> RAM</span>
												<span>{server.healthMemory || 0}%</span>
											</div>
											<div class="bg-muted h-1 w-full overflow-hidden rounded-full">
												<div
													class="bg-primary h-full transition-all duration-500"
													style="width: {server.healthMemory || 0}%"
												></div>
											</div>
										</div>
									</div>
								</Card.Content>
								<a
									href="/servers/{server.id}"
									class="bg-muted/30 hover:bg-muted/50 text-muted-foreground flex items-center justify-center border-t p-2 text-[10px] font-bold tracking-widest uppercase transition-colors"
								>
									Manage Server <ArrowUpRight class="ml-1 size-3" />
								</a>
							</Card.Root>
						{/each}
						{#if servers.length === 0}
							<Card.Root
								class="flex flex-col items-center justify-center border-dashed py-10 sm:col-span-2"
							>
								<Server class="text-muted-foreground/30 mb-2 size-8" />
								<p class="text-muted-foreground text-sm">No servers connected</p>
								<a href="/servers" class="text-primary mt-2 text-xs underline"
									>Connect your first server</a
								>
							</Card.Root>
						{/if}
					</div>
				</div>

				<!-- Global Checks -->
				<div class="space-y-4">
					<h2 class="text-lg font-semibold">Service Health</h2>
					<div class="space-y-3">
						{#each checks as check}
							<Card.Root>
								<Card.Content class="flex items-center justify-between p-4">
									<div class="flex items-center gap-3">
										<div class="bg-primary/10 text-primary rounded-lg p-2">
											<check.icon class="size-4" />
										</div>
										<span class="text-sm font-medium">{check.label}</span>
									</div>
									<div class="flex items-center gap-1.5">
										<div class="size-2 animate-pulse rounded-full bg-green-500"></div>
										<span class="text-xs font-semibold text-green-600">{check.status}</span>
									</div>
								</Card.Content>
							</Card.Root>
						{/each}
					</div>

					<Card.Root class="bg-muted/30 border-dashed">
						<Card.Content class="p-4 text-center">
							<p class="text-muted-foreground mb-3 text-xs">
								The SelfHost Cloud Agent sends encrypted heartbeats every 5 seconds to ensure maximum
								availability.
							</p>
							<Badge variant="outline" class="font-mono text-[10px]">v0.1.0-alpha</Badge>
						</Card.Content>
					</Card.Root>
				</div>
			</div>
		{/if}
	</div>
{/if}

<Dialog.Root open={onboardingModalOpen} onOpenChange={handleModalOpenChange}>
	<Dialog.Content class="sm:max-w-[425px]">
		{#if page.state.onboardingStep === 'ssh-key'}
			<Dialog.Header>
				<Dialog.Title>Enroll Key</Dialog.Title>
				<Dialog.Description>Securely ingest a new SSH private key.</Dialog.Description>
			</Dialog.Header>
			<AddKeyForm onSuccess={handleSuccess} />
		{:else if page.state.onboardingStep === 'server'}
			<Dialog.Header>
				<Dialog.Title>Register Server</Dialog.Title>
				<Dialog.Description>Add a new server via SSH connection.</Dialog.Description>
			</Dialog.Header>
			<RegisterServerForm privateKeys={contextData.privateKeys} onSuccess={handleSuccess} />
		{/if}
	</Dialog.Content>
</Dialog.Root>
