<script lang="ts">
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import ActivityFeed from '$lib/components/ActivityFeed.svelte';
	import CommandMenu from '$lib/components/CommandMenu.svelte';
	import { authStore } from '$lib/stores/auth';
	import { switchTeam, switchCompany, impersonateUser, stopImpersonating } from './layout.remote';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import { Button } from '$lib/components/ui/button';
	import { LogOut, AlertTriangle } from '@lucide/svelte';

	let { data, children } = $props();
	
	// Type assertion for impersonation fields that are returned from layout server
	// These fields exist in the return value but TypeScript types may not be up to date
	const layoutData = $derived(data as typeof data & {
		isImpersonating?: boolean;
		impersonationType?: 'user' | 'team' | 'company' | null;
		impersonatedBy?: any | null;
		impersonationEntity?: any | null;
		activeCompany?: any | null;
		companies?: any[];
		users?: any[];
		isSuperAdmin?: boolean;
		isGod?: boolean;
	});

	let sidebarOpen = $state(false);

	$effect(() => {
		// (app) layout is only for authenticated users
		if (data?.user) {
			// Type assertion to handle missing emailVerifiedAt field
			authStore.setUser(data.user as any, data.team as any);
		} else {
			// No user - should not happen in (app) group, but handle gracefully
			authStore.setLoading(false);
		}
	});

	// Simple: Show banner if impersonating OR if there's an active team/company context
	const shouldShowBanner = $derived(
		!!layoutData.isImpersonating || !!(data.team?.id) || !!(layoutData.activeCompany?.id)
	);

	import { authClient } from '$lib/auth-client';

	async function handleStopImpersonating() {
		try {
			// Use remote function to stop impersonation (handles all types)
			if (!stopImpersonating) {
				toastStore.error('Stop impersonating function not available');
				return;
			}
			const result = await stopImpersonating();
			if (!result.success) {
				toastStore.error(result.message || 'Failed to stop impersonating');
				return;
			}
			toastStore.success('Stopped impersonating');
			window.location.reload(); // Reload to reflect the original context
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || error.message || 'Failed to stop impersonation');
		}
	}
</script>

<div class="bg-background text-foreground min-h-screen">
	<!-- Show banner based on computed condition -->
	{#if shouldShowBanner}
		<!-- Prominent impersonation banner - fixed at top, above all content -->
		<!-- Positioned to account for sidebar (left-64 = 256px = sidebar width) -->
		<div class="fixed top-0 left-64 right-0 z-[100] bg-yellow-500 dark:bg-yellow-600 border-b-2 border-yellow-600 dark:border-yellow-700 shadow-lg">
			<div class="w-full px-6 py-3 flex items-center justify-between max-w-full">
				<div class="flex items-center gap-3 flex-1 min-w-0">
					<AlertTriangle class="size-5 text-yellow-900 dark:text-yellow-100 flex-shrink-0" />
					<div class="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0">
						<span class="text-sm font-semibold text-yellow-900 dark:text-yellow-100 whitespace-nowrap">
							{#if layoutData.isImpersonating && layoutData.impersonatedBy}
								⚠️ Impersonation Mode Active:
							{:else}
								⚠️ Viewing Different Context:
							{/if}
						</span>
						<span class="text-sm font-medium text-yellow-900 dark:text-yellow-100 truncate">
							{#if layoutData.isImpersonating && layoutData.impersonatedBy}
								{#if layoutData.impersonationType === 'user'}
									You are impersonating user <strong>{data.user?.name || data.user?.email}</strong>
								{:else if layoutData.impersonationType === 'team'}
									You are impersonating team <strong>{layoutData.impersonationEntity?.name || 'Unknown Team'}</strong>
								{:else if layoutData.impersonationType === 'company'}
									You are impersonating company <strong>{layoutData.impersonationEntity?.name || 'Unknown Company'}</strong>
								{:else}
									You are impersonating <strong>{data.user?.name || data.user?.email}</strong>
								{/if}
								<span class="text-yellow-800 dark:text-yellow-200"> as {layoutData.impersonatedBy.name || layoutData.impersonatedBy.email}</span>
							{:else}
								{#if data.team}
									Viewing team context: <strong>{data.team.name}</strong>
								{:else if layoutData.activeCompany}
									Viewing company context: <strong>{layoutData.activeCompany.name}</strong>
								{/if}
							{/if}
						</span>
					</div>
				</div>
				<Button 
					variant="outline" 
					size="sm" 
					onclick={layoutData.isImpersonating ? handleStopImpersonating : async () => {
						// Clear context (return to God mode)
						if (switchTeam) {
							const result = await switchTeam({ teamId: '' });
							if (result.success) {
								window.location.reload();
							}
						}
					}}
					class="ml-4 bg-white dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100 border-yellow-700 dark:border-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-600 flex-shrink-0"
				>
					<LogOut class="mr-2 size-4" />
					{layoutData.isImpersonating ? 'Exit Impersonation' : 'Return to God Mode'}
				</Button>
			</div>
		</div>
	{/if}

	{#if data?.user}
		{@const sidebarData = data as any}
		<Sidebar bind:sidebarOpen currentTeam={data.team} activeCompany={layoutData.activeCompany} teams={data.teams} companies={layoutData.companies || []} users={layoutData.users || []} isSuperAdmin={sidebarData.isSuperAdmin || false} isGod={sidebarData.isGod || false} isImpersonating={sidebarData.isImpersonating || false} impersonationType={sidebarData.impersonationType || layoutData.impersonationType} websiteMode={sidebarData.websiteMode || false} {switchTeam} {switchCompany} impersonateUser={impersonateUser} stopImpersonating={async () => await stopImpersonating()} />
	{/if}

	<main class:pl-64={!!data?.user} class:pt-14={shouldShowBanner && !!data?.user}>
		<div class="w-full max-w-none px-8 py-6">
			{@render children?.()}
		</div>
	</main>

	{#if data?.user}
		<ActivityFeed />
		<CommandMenu />
	{/if}

	{#if data?.user}
		<div
			class="border-border/40 bg-background/95 text-muted-foreground supports-backdrop-filter:bg-background/60 fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[10px] font-medium shadow-sm backdrop-blur"
		>
			<span class="text-xs">⌘</span>K
		</div>
	{/if}
</div>
