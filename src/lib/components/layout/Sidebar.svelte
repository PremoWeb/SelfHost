<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import ContextSwitcher from './ContextSwitcher.svelte';
	import type { Team } from '$lib/server/db/schema';
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
		FileText
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
		switchTeam,
		switchCompany,
		impersonateUser,
		stopImpersonating
	}: Props = $props();

	const shouldShowContextSwitcher = $derived(
		isGod || teams.length > 0 || companies.length > 0 || isImpersonating || isSuperAdmin
	);

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
		<div class="flex flex-col justify-center">
			<div class="text-lg leading-none font-bold">SelfHost.gg</div>
			<div class="text-muted-foreground mt-1 text-[10px]">
				by <a
					href="https://premoweb.com?utm_source=selfhost&utm_medium=logo&utm_campaign=selfhost"
					target="_blank"
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

	<div class="border-t p-4">
		<form
			action="/api/auth/logout"
			method="POST"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						authStore.logout();
						await goto('/login');
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
