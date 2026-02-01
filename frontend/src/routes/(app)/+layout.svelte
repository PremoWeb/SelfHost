<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import { invalidateAll } from '$app/navigation';
	import { switchTeam, stopImpersonating } from './layout.remote';
	import { toastStore } from '$lib/stores/toast';
	import { Button } from '$lib/components/ui/button';
	import { LogOut, AlertTriangle } from 'lucide-svelte';
	import { wsStore } from '$lib/stores/websocket';
	import { browser } from '$app/environment';

	let { data, children } = $props();

	// Type assertion for impersonation fields that are returned from layout server
	// These fields exist in the return value but TypeScript types may not be up to date
	const layoutData = $derived(
		data as typeof data & {
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
		// (app) layout is only for authenticated users
		if (data?.user) {
			// Type assertion to handle missing emailVerifiedAt field
			authStore.setUser(data.user as any, data.team as any);
		} else {
			// No user - should not happen in (app) group, but handle gracefully
			authStore.setLoading(false);
		}
	});

	// WebSocket connection and updates
	$effect(() => {
		if (browser) {
			wsStore.connect();
		}
	});

	let lastHandledMessage = $state<any>(null);
	$effect(() => {
		const msg = $wsStore.lastMessage;
		if (msg) {
			// Svelte 5 proxy equality mismatch fix: compare by unique ID/timestamp
			// The store now adds a timestamp to every message
			if (!lastHandledMessage || msg.timestamp !== lastHandledMessage.timestamp) {
				lastHandledMessage = msg;
				if (msg.type === 'db_update') {
					// Refresh data when relevant tables change
					if (['servers', 'projects', 'deployments'].includes(msg.table)) {
						invalidateAll();
					}
				}
			}
		}
	});

	// Simple: Show banner if impersonating OR if there's an active team/company context
	const shouldShowBanner = $derived(
		!!layoutData.isImpersonating || !!data.team?.id || !!layoutData.activeCompany?.id
	);

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
			await invalidateAll();
		} catch (error: any) {
			toastStore.error(
				error.response?.data?.message || error.message || 'Failed to stop impersonation'
			);
		}
	}
</script>

<!-- (app) adds only the impersonation/context banner; root layout provides Sidebar + main + single px-8 wrapper -->
{#if shouldShowBanner}
	<!-- Prominent impersonation banner - fixed at top, above all content (left-64 = sidebar width) -->
	<div
		class="fixed top-0 right-0 left-64 z-100 border-b-2 border-yellow-600 bg-yellow-500 shadow-lg dark:border-yellow-700 dark:bg-yellow-600"
	>
		<div class="flex w-full max-w-full items-center justify-between px-6 py-3">
			<div class="flex min-w-0 flex-1 items-center gap-3">
				<AlertTriangle class="size-5 shrink-0 text-yellow-900 dark:text-yellow-100" />
				<div class="flex min-w-0 flex-col sm:flex-row sm:items-center sm:gap-2">
					<span
						class="text-sm font-semibold whitespace-nowrap text-yellow-900 dark:text-yellow-100"
					>
						{#if layoutData.isImpersonating && layoutData.impersonatedBy}
							⚠️ Impersonation Mode Active:
						{:else}
							⚠️ Viewing Different Context:
						{/if}
					</span>
					<span class="truncate text-sm font-medium text-yellow-900 dark:text-yellow-100">
						{#if layoutData.isImpersonating && layoutData.impersonatedBy}
							{#if layoutData.impersonationType === 'user'}
								You are impersonating user <strong>{data.user?.name || data.user?.email}</strong>
							{:else if layoutData.impersonationType === 'team'}
								You are impersonating team <strong
									>{layoutData.impersonationEntity?.name || 'Unknown Team'}</strong
								>
							{:else if layoutData.impersonationType === 'company'}
								You are impersonating company <strong
									>{layoutData.impersonationEntity?.name || 'Unknown Company'}</strong
								>
							{:else}
								You are impersonating <strong>{data.user?.name || data.user?.email}</strong>
							{/if}
							<span class="text-yellow-800 dark:text-yellow-200">
								as {layoutData.impersonatedBy.name || layoutData.impersonatedBy.email}</span
							>
						{:else if data.team}
							Viewing team context: <strong>{data.team.name}</strong>
						{:else if layoutData.activeCompany}
							Viewing company context: <strong>{layoutData.activeCompany.name}</strong>
						{/if}
					</span>
				</div>
			</div>
			<Button
				variant="outline"
				size="sm"
				onclick={layoutData.isImpersonating
					? handleStopImpersonating
					: async () => {
							// Clear context (return to God mode)
							if (switchTeam) {
								const result = await switchTeam({ teamId: '' });
								if (result.success) {
									await invalidateAll();
								}
							}
						}}
				class="ml-4 shrink-0 border-yellow-700 bg-white text-yellow-900 hover:bg-yellow-50 dark:border-yellow-500 dark:bg-yellow-700 dark:text-yellow-100 dark:hover:bg-yellow-600"
			>
				<LogOut class="mr-2 size-4" />
				{layoutData.isImpersonating ? 'Exit Impersonation' : 'Return to God Mode'}
			</Button>
		</div>
	</div>
{/if}

{@render children?.()}
