<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import ContextSwitcher from './ContextSwitcher.svelte';
	import type { Team } from '$lib/server/db/schema';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import {
		LayoutDashboard,
		Layers,
		Server,
		Code2,
		Map,
		Database,
		Variable,
		Bell,
		ShieldCheck,
		Tag,
		Terminal,
		User,
		Users,
		Cloud,
		Globe,
		Network,
		Settings,
		LogOut,
		BookOpen,
		FileText,
		Monitor
	} from '@lucide/svelte';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { setMode, resetMode } from 'mode-watcher';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { authStore } from '$lib/stores/auth';

	interface Props {
		sidebarOpen: boolean;
		currentTeam: Team | null;
		activeCompany?: any | null;
		teams: (Team & { role: string })[];
		companies?: any[];
		users?: any[];
		isSuperAdmin?: boolean;
		isGod?: boolean;
		isImpersonating?: boolean;
		impersonationType?: 'user' | 'team' | 'company' | null;
		switchTeam?: (args: { teamId: string }) => Promise<{ success: boolean; message?: string }>;
		switchCompany?: (args: {
			companyId: string;
		}) => Promise<{ success: boolean; message?: string }>;
		impersonateUser?: (args: {
			userId: string;
		}) => Promise<{ success: boolean; message?: string; data?: any }>;
		stopImpersonating?: () => Promise<{ success: boolean; message?: string; data?: any }>;
		websiteMode?: boolean;
	}

	let {
		sidebarOpen = $bindable(false),
		currentTeam,
		activeCompany = null,
		teams = [],
		companies = [],
		users = [],
		isSuperAdmin = false,
		isGod = false,
		isImpersonating = false,
		impersonationType = null,
		websiteMode = false,
		switchTeam,
		switchCompany,
		impersonateUser,
		stopImpersonating
	}: Props = $props();

	const shouldShowContextSwitcher = $derived(
		isGod || teams.length > 0 || companies.length > 0 || isImpersonating || isSuperAdmin
	);

	let isTogglingWebsiteMode = $state(false);

	async function handleToggleWebsiteMode() {
		if (isTogglingWebsiteMode) return;
		
		isTogglingWebsiteMode = true;
		try {
			const newValue = !websiteMode;
			const response = await api.post('/settings/website-mode', { enabled: newValue });
			
			// API returns { data: { success: true, websiteMode: enabled } }
			// axios wraps it in response.data, so we need response.data.data
			if (response.data?.data?.success) {
				// Invalidate all to refresh the page with new website mode
				await invalidateAll();
				toastStore.success('Website mode ' + (newValue ? 'enabled' : 'disabled'));
			} else {
				toastStore.error(response.data?.data?.message || response.data?.message || 'Failed to toggle website mode');
			}
		} catch (error: any) {
			toastStore.error(error.response?.data?.data?.message || error.response?.data?.message || error.message || 'Failed to toggle website mode');
		} finally {
			isTogglingWebsiteMode = false;
		}
	}

	const navigationGroups = [
		{
			name: 'Core',
			items: [{ label: 'Dashboard', href: '/', icon: LayoutDashboard }]
		},
		{
			name: 'Infrastructure',
			items: [
				{ label: 'Servers', href: '/servers', icon: Server },
				{ label: 'Cloud Providers', href: '/cloud-providers', icon: Cloud },
				{ label: 'Security', href: '/security/private-key', icon: ShieldCheck },
				{ label: 'Destinations', href: '/destinations', icon: Map }
			]
		},
		{
			name: 'Networking',
			items: [
				{ label: 'Domains', href: '/domains', icon: Globe },
				{ label: 'Name Servers', href: '/nameservers', icon: Network }
			]
		},
		{
			name: 'Deployment',
			items: [
				{ label: 'Projects', href: '/projects', icon: Layers },
				{ label: 'Sources', href: '/sources', icon: Code2 },
				{ label: 'Variables', href: '/variables', icon: Variable },
				{ label: 'Storage', href: '/storages', icon: Database },
				{ label: 'Tags', href: '/tags', icon: Tag }
			]
		},
		{
			name: 'CRM',
			items: [{ label: 'Clients (CRM)', href: '/clients', icon: User }]
		},
		{
			name: 'Workspace',
			items: [
				{ label: 'Teams', href: '/team', icon: Users },
				{ label: 'Action Logs', href: '/logs', icon: FileText },
				{ label: 'Terminal', href: '/terminal', icon: Terminal }
			]
		},
		{
			name: 'Support',
			items: [
				{ label: 'Settings', href: '/settings', icon: Settings },
				{ label: 'Documentation', href: '/docs', icon: BookOpen },
				{ label: 'Profile', href: '/profile', icon: User }
			]
		}
	];

	const currentPath = $derived(page.url.pathname);
</script>

<aside class="bg-background fixed inset-y-0 left-0 flex w-64 flex-col border-r">
	<div class="flex h-16 items-center justify-between border-b px-6">
		<div 
			class="flex flex-col justify-center hover:opacity-80 transition-opacity cursor-pointer"
			onclick={() => goto('/')}
			role="button"
			tabindex="0"
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					goto('/');
				}
			}}
		>
			<div class="text-lg leading-none font-bold">SelfHost.gg</div>
			<div class="text-muted-foreground mt-1 text-[10px]">
				by <a
					href="https://premoweb.com?utm_source=selfhost&utm_medium=logo&utm_campaign=selfhost"
					target="_blank"
					onclick={(e) => e.stopPropagation()}
					class="text-primary/80 hover:underline">PremoWeb LLC</a
				>
			</div>
		</div>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class={buttonVariants({ variant: 'ghost', size: 'icon' }) + ' relative h-8 w-8'}
			>
				<SunIcon
					class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
				/>
				<MoonIcon
					class="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
				/>
				<span class="sr-only">Toggle theme</span>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Item onclick={() => setMode('light')}>Light</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => setMode('dark')}>Dark</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => resetMode()}>System</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>

	{#if shouldShowContextSwitcher}
		<div class="border-b p-4">
			<ContextSwitcher
				{currentTeam}
				{activeCompany}
				{teams}
				{companies}
				{users}
				{isSuperAdmin}
				{isGod}
				{isImpersonating}
				{impersonationType}
				{switchTeam}
				{switchCompany}
				{impersonateUser}
				{stopImpersonating}
			/>
		</div>
	{/if}

	<nav class="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-4">
		{#each navigationGroups as group}
			<div class="space-y-1">
				{#if group.name !== 'Core'}
					<h4
						class="text-muted-foreground/60 mb-2 px-3 text-[10px] font-bold tracking-wider uppercase"
					>
						{group.name}
					</h4>
				{/if}
				{#each group.items as item}
					{@const isActive =
						currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))}
					<a
						href={item.href}
						class="flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors {isActive
							? 'bg-secondary text-foreground font-medium'
							: 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}"
					>
						<item.icon class="size-4" />
						{item.label}
					</a>
				{/each}
			</div>
		{/each}
	</nav>

	<style>
		.custom-scrollbar::-webkit-scrollbar {
			width: 4px;
		}
		.custom-scrollbar::-webkit-scrollbar-track {
			background: transparent;
		}
		.custom-scrollbar::-webkit-scrollbar-thumb {
			background: hsl(var(--muted-foreground) / 0.1);
			border-radius: 10px;
		}
		.custom-scrollbar::-webkit-scrollbar-thumb:hover {
			background: hsl(var(--muted-foreground) / 0.2);
		}
	</style>

	<div class="border-t space-y-2 p-4">
		{#if isGod}
			<Button
				variant="ghost"
				class="w-full justify-start"
				onclick={handleToggleWebsiteMode}
				disabled={isTogglingWebsiteMode}
			>
				<Monitor class="mr-2 size-4" />
				Website Mode
				<div class="ml-auto">
					<div class="relative h-4 w-8 rounded-full {websiteMode ? 'bg-primary' : 'bg-muted'}" role="switch" aria-checked={websiteMode}>
						<div class="absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform {websiteMode ? 'translate-x-4' : ''}"></div>
					</div>
				</div>
			</Button>
		{/if}
		<form
			action="/api/auth/logout"
			method="POST"
			use:enhance={() => {
				// Clear auth store immediately for better UX
				authStore.logout();
				
				// Return handler for the form submission
				return async ({ result, update }) => {
					// If server redirects, invalidate all data and update
					// This ensures fresh data is loaded after logout
					if (result.type === 'redirect') {
						// Invalidate all data to force fresh load after logout
						await invalidateAll();
						await update();
					} else if (result.type === 'success') {
						// If server returned JSON (API call), invalidate and navigate manually
						await invalidateAll();
						await goto('/');
					} else if (result.type === 'failure' || result.type === 'error') {
						// Handle errors
						toastStore.error('Failed to sign out');
					}
				};
			}}
		>
			<Button
				type="submit"
				variant="ghost"
				class="text-destructive hover:text-destructive hover:bg-destructive/10 w-full justify-start"
			>
				<LogOut class="mr-2 size-4" />
				Sign Out
			</Button>
		</form>
	</div>
</aside>
