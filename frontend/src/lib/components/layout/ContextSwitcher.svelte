<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import type { Team } from '$lib/types';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { ChevronsUpDown, Check, Users, Shield, Building2, User, Crown, UserCheck } from '@lucide/svelte';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import { authClient } from '$lib/auth-client';
	import { stopImpersonating } from '../../../routes/(app)/layout.remote';
	
	interface Props {
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
		switchCompany?: (args: { companyId: string }) => Promise<{ success: boolean; message?: string }>;
		impersonateUser?: (args: { userId: string }) => Promise<{ success: boolean; message?: string; data?: any }>;
		stopImpersonating?: () => Promise<{ success: boolean; message?: string; data?: any }>;
	}

	let { currentTeam, activeCompany = null, teams = [], companies = [], users = [], isSuperAdmin = false, isGod = false, isImpersonating = false, impersonationType = null, switchTeam, switchCompany, impersonateUser, stopImpersonating: stopImpersonatingRemote }: Props = $props();

	// Debug logging
	$effect(() => {
		// Component initialized
	});

	async function handleSwitchTeam(teamId: string) {
		// Don't switch if already on this team
		if (teamId === currentTeam?.id) {
			return;
		}

		if (!switchTeam) {
			return;
		}

		const result = await switchTeam({ teamId });

		if (result.success) {
			// Invalidate all load functions - SvelteKit will smoothly update the page data
			await invalidateAll();
		} else {
			toastStore.error(result.message || 'Failed to switch team');
		}
	}

	async function handleSwitchCompany(companyId: string) {
		// Don't switch if already on this company
		if (companyId === activeCompany?.id) return;

		if (!switchCompany) {
			return;
		}

		const result = await switchCompany({ companyId });

		if (result.success) {
			// Invalidate all load functions - SvelteKit will smoothly update the page data
			await invalidateAll();
		} else {
			toastStore.error(result.message || 'Failed to switch company');
		}
	}

	async function handleClearContext() {
		// If impersonating, stop impersonation first
		if (isImpersonating) {
			try {
				// Use the remote function which handles both Better Auth and custom impersonation
				const result = await stopImpersonating();
				if (result.success) {
					toastStore.success('Stopped impersonating');
				} else {
					toastStore.error(result.message || 'Failed to stop impersonation');
					return;
				}
				await invalidateAll();
				window.location.href = '/';
				return;
			} catch (error: any) {
				toastStore.error(error.response?.data?.message || error.message || 'Failed to stop impersonation');
				return;
			}
		}

		// Clear both team and company context to return to God Mode
		if (switchTeam) {
			const result = await switchTeam({ teamId: '' });
			if (result.success) {
				await invalidateAll();
			}
		}
	}

	async function handleImpersonate(type: 'user' | 'team' | 'company', id: string) {
		try {
			if (type === 'user') {
				// Use remote function for user impersonation
				if (!impersonateUser) {
					toastStore.error('Impersonate user function not available');
					return;
				}
				const result = await impersonateUser({ userId: id });
				if (!result.success) {
					toastStore.error(result.message || 'Failed to impersonate user');
					return;
				}
				toastStore.success(`Impersonating user: ${result.data?.data?.user?.name || id}`);
				await invalidateAll();
				// Use reload() instead of href to ensure cookies are properly sent
				window.location.reload();
			} else {
				// Use custom API for team/company impersonation
				const response = (await api.post('/users/impersonate', { type, id })) as any;
				toastStore.success(`Impersonating ${type}: ${response.data.entity.name}`);
				await invalidateAll();
				window.location.href = '/';
			}
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || error.message || `Failed to impersonate ${type}`);
		}
	}

	// Determine display text and icon
	const displayText = $derived(
		isImpersonating && impersonationType
			? impersonationType === 'team' && currentTeam
				? `Team: ${currentTeam.name}`
				: impersonationType === 'company' && activeCompany
					? `Company: ${activeCompany.name}`
					: impersonationType === 'user'
						? `User: ${currentTeam?.name || 'Impersonating'}`
						: 'Select Context'
			: activeCompany
				? activeCompany.name
				: currentTeam
					? currentTeam.name
					: isGod
						? 'God Mode'
						: isSuperAdmin
							? 'Super Admin'
							: 'Select Context'
	);

	const displayIcon = $derived(
		activeCompany
			? (activeCompany.name?.charAt(0) || 'C')
			: currentTeam
				? (currentTeam.name?.charAt(0) || 'T')
				: isGod
					? 'G'
					: isSuperAdmin
						? 'A'
						: 'T'
	);
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class={buttonVariants({ variant: 'outline', className: 'w-full justify-between' })}
	>
		<div class="flex items-center gap-2 truncate">
			<div
				class="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-sm border text-[10px] font-medium"
			>
				{displayIcon}
			</div>
			<div class="flex items-center gap-1.5 truncate">
				<span class="truncate">{displayText}</span>
				{#if isGod}
					<Crown class="size-3 text-primary shrink-0" />
				{:else if isSuperAdmin}
					<Shield class="size-3 text-primary shrink-0" />
				{/if}
			</div>
		</div>
		<ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class="w-[280px] max-h-[400px] overflow-y-auto">
		{#if isGod}
			<p class="text-muted-foreground px-2 py-1.5 text-xs">
				Switch your view: select a team, company, or user to act as.
			</p>
			<DropdownMenu.Separator />
			<DropdownMenu.Label>
				<div class="flex items-center gap-2">
					<Crown class="size-4 text-primary" />
					<span>God Mode</span>
				</div>
			</DropdownMenu.Label>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				onclick={handleClearContext}
				class="flex cursor-pointer items-center justify-between"
			>
				<div class="flex items-center gap-2">
					<Crown class="size-4 text-primary" />
					<span>{isImpersonating ? 'Exit Impersonation' : 'God Mode (No Context)'}</span>
				</div>
				{#if !currentTeam && !activeCompany && !isImpersonating}
					<Check class="ml-2 size-4" />
				{/if}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
		{/if}

		<DropdownMenu.Label>
			<div class="flex items-center gap-2">
				<Users class="size-4" />
				<span>Teams</span>
				{#if isGod}
					<span class="text-xs text-muted-foreground">({teams.length})</span>
				{/if}
			</div>
		</DropdownMenu.Label>
		<DropdownMenu.Separator />
		{#if teams.length > 0}
			{#each teams as team}
				<DropdownMenu.Item
					onclick={() => handleSwitchTeam(team.id)}
					class="flex cursor-pointer items-center justify-between group"
				>
					<div class="flex items-center gap-2 truncate flex-1">
						<Users class="size-3.5 text-muted-foreground shrink-0" />
						<span class="truncate">{team.name}</span>
						{#if team.personalTeam}
							<span class="text-xs text-muted-foreground">(Personal)</span>
						{/if}
					</div>
					<div class="flex items-center gap-1">
						{#if team.id === currentTeam?.id}
							<Check class="ml-2 size-4 shrink-0" />
						{/if}
						{#if isGod}
							<button
								type="button"
								class="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 flex items-center justify-center hover:bg-accent rounded"
								onclick={(e) => {
									e.stopPropagation();
									handleImpersonate('team', team.id);
								}}
								title="Impersonate this team"
							>
								<UserCheck class="size-3" />
							</button>
						{/if}
					</div>
				</DropdownMenu.Item>
			{/each}
		{:else}
			<DropdownMenu.Item disabled class="text-muted-foreground">
				<div class="flex items-center gap-2">
					<Users class="size-3.5 text-muted-foreground shrink-0" />
					<span class="text-sm">No teams yet</span>
				</div>
			</DropdownMenu.Item>
		{/if}
		<DropdownMenu.Separator />

		{#if isGod}
			<DropdownMenu.Label>
				<div class="flex items-center gap-2">
					<Building2 class="size-4" />
					<span>Companies</span>
					{#if companies.length > 0}
						<span class="text-xs text-muted-foreground">({companies.length})</span>
					{/if}
				</div>
			</DropdownMenu.Label>
			<DropdownMenu.Separator />
			{#if companies.length > 0}
				{#each companies as company}
					<DropdownMenu.Item
						onclick={() => handleSwitchCompany(company.id)}
						class="flex cursor-pointer items-center justify-between group"
					>
						<div class="flex items-center gap-2 truncate flex-1">
							<Building2 class="size-3.5 text-muted-foreground shrink-0" />
							<span class="truncate">{company.name}</span>
							{#if company.slug}
								<span class="text-xs text-muted-foreground">({company.slug})</span>
							{/if}
						</div>
						<div class="flex items-center gap-1">
							{#if activeCompany && activeCompany.id === company.id}
								<Check class="ml-2 size-4 shrink-0" />
							{/if}
							{#if isGod}
								<button
									type="button"
									class="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 flex items-center justify-center hover:bg-accent rounded"
									onclick={(e) => {
										e.stopPropagation();
										handleImpersonate('company', company.id);
									}}
									title="Impersonate this company"
								>
									<UserCheck class="size-3" />
								</button>
							{/if}
						</div>
					</DropdownMenu.Item>
				{/each}
			{:else}
				<DropdownMenu.Item disabled class="text-muted-foreground">
					<div class="flex items-center gap-2">
						<Building2 class="size-3.5 text-muted-foreground shrink-0" />
						<span class="text-sm">No companies available</span>
					</div>
				</DropdownMenu.Item>
			{/if}
			<DropdownMenu.Separator />
		{/if}

		{#if isGod}
			<DropdownMenu.Label>
				<div class="flex items-center gap-2">
					<User class="size-4" />
					<span>Individuals</span>
					<span class="text-xs text-muted-foreground">({users.length})</span>
				</div>
			</DropdownMenu.Label>
			<DropdownMenu.Separator />
			{#if users.length > 0}
				{#each users as user}
					<DropdownMenu.Item
						onclick={() => handleImpersonate('user', user.id)}
						class="flex cursor-pointer items-center justify-between group"
					>
						<div class="flex items-center gap-2 truncate flex-1">
							<User class="size-3.5 text-muted-foreground shrink-0" />
							<span class="truncate">{user.name || user.email}</span>
							{#if user.isGod}
								<Crown class="size-3 text-primary shrink-0" />
							{/if}
						</div>
						<UserCheck class="size-4 shrink-0 opacity-50" />
					</DropdownMenu.Item>
				{/each}
			{:else}
				<DropdownMenu.Item disabled class="text-muted-foreground">
					<div class="flex items-center gap-2">
						<User class="size-3.5 text-muted-foreground shrink-0" />
						<span class="text-sm">No users</span>
					</div>
				</DropdownMenu.Item>
			{/if}
			<DropdownMenu.Separator />
		{/if}

		<DropdownMenu.Item onclick={() => goto('/team')} class="cursor-pointer">
			<Users class="mr-2 size-4" />
			Team Settings
		</DropdownMenu.Item>
		{#if isGod}
			<DropdownMenu.Item onclick={() => goto('/settings?tab=companies')} class="cursor-pointer">
				<Building2 class="mr-2 size-4" />
				Company Management
			</DropdownMenu.Item>
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>
