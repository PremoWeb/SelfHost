<script lang="ts">
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';
	import { page } from '$app/state';
	import Toast from '$lib/components/ui/Toast.svelte';
	import '../app.css';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import ActivityFeed from '$lib/components/ActivityFeed.svelte';
	import CommandMenu from '$lib/components/CommandMenu.svelte';
	import { authStore } from '$lib/stores/auth';
	import {
		switchTeam,
		switchCompany,
		impersonateUser,
		stopImpersonating
	} from './(app)/layout.remote';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import { Button } from '$lib/components/ui/button';
	import { LogOut, AlertTriangle } from 'lucide-svelte';

	import { ModeWatcher } from 'mode-watcher';
	import { setupViewTransition } from 'sveltekit-view-transition';

	let { data, children }: { data?: any; children: any } = $props();

	setupViewTransition();

	// Root layout has no load; use current page's data so / gets shouldUseAppLayout from +page.ts
	const pageData = $derived(page.data as any);
	const mergedData = $derived(pageData ?? data ?? {});

	// WebSocket initialization removed
	onMount(() => {
		// No-op
	});

	// Check if we should use app layout (sidebar, etc.) — use page data so / shows sidebar when logged in
	const shouldUseAppLayout = $derived(Boolean(mergedData?.shouldUseAppLayout));
	const layoutData = $derived(
		mergedData as typeof mergedData & {
			isImpersonating?: boolean;
			impersonationType?: 'user' | 'team' | 'company' | null;
			impersonatedBy?: any | null;
			impersonationEntity?: any | null;
			activeCompany?: any | null;
			companies?: any[];
			users?: any[];
			isSuperAdmin?: boolean;
			isGod?: boolean;
		}
	);

	let sidebarOpen = $state(false);

	$effect(() => {
		if (shouldUseAppLayout && mergedData?.user) {
			authStore.setUser(mergedData.user as any, mergedData.team as any);
		} else {
			authStore.setLoading(false);
		}
	});

	const shouldShowBanner = $derived(
		shouldUseAppLayout &&
			(!!layoutData.isImpersonating || !!mergedData?.team?.id || !!layoutData.activeCompany?.id)
	);
</script>

<ModeWatcher />
<PageTitle />
<svelte:head>
	<meta name="description" content="Self-hostable cloud infrastructure management" />
</svelte:head>

<div class="bg-background text-foreground min-h-screen transition-colors duration-300">
	<!-- Toast notifications -->
	<Toast />

	{#if shouldUseAppLayout}
		<!-- App Layout: Sidebar, Activity Feed, Command Menu -->
		<div class="flex w-full min-w-0">
			{#if true}
				{@const sidebarData = mergedData}
				<Sidebar
					bind:sidebarOpen
					currentTeam={mergedData?.team ?? null}
					activeCompany={layoutData.activeCompany}
					teams={mergedData?.teams ?? []}
					companies={layoutData.companies || []}
					users={layoutData.users || []}
					isSuperAdmin={sidebarData.isSuperAdmin || false}
					isGod={sidebarData.isGod || false}
					isImpersonating={sidebarData.isImpersonating || false}
					impersonationType={sidebarData.impersonationType || layoutData.impersonationType}
					websiteMode={sidebarData.websiteMode || false}
					{switchTeam}
					{switchCompany}
					{impersonateUser}
					{stopImpersonating}
				/>
			{/if}

			<main class="w-full min-w-0 flex-1 pl-64" class:pt-14={shouldShowBanner}>
				<div class="w-full max-w-none px-8 py-6">
					<Tooltip.Provider>
						{@render children()}
					</Tooltip.Provider>
				</div>
			</main>
		</div>

		<ActivityFeed />
		<CommandMenu />
	{:else}
		<!-- Public Layout: Minimal, no sidebar -->
		<main>
			<Tooltip.Provider>
				{@render children()}
			</Tooltip.Provider>
		</main>
	{/if}

	{#if shouldUseAppLayout}
		<div
			class="border-border/40 bg-background/95 text-muted-foreground supports-backdrop-filter:bg-background/60 fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[10px] font-medium shadow-sm backdrop-blur"
		>
			<span class="text-xs">⌘</span>K
		</div>
	{/if}
</div>
<Toaster />
