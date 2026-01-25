<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import type { Team } from '$lib/server/db/schema';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { ChevronsUpDown, Check, Users, Shield, Building2, User, Crown, UserCheck } from '@lucide/svelte';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	
	interface Props {
		currentTeam: Team | null;
		activeCompany?: any | null;
		teams: (Team & { role: string })[];
		companies?: any[];
		users?: any[];
		isSuperAdmin?: boolean;
		isGod?: boolean;
		switchTeam?: (args: { teamId: string }) => Promise<{ success: boolean; message?: string }>;
		switchCompany?: (args: { companyId: string }) => Promise<{ success: boolean; message?: string }>;
	}

	let { currentTeam, activeCompany = null, teams = [], companies = [], users = [], isSuperAdmin = false, isGod = false, switchTeam, switchCompany }: Props = $props();

	// Debug logging
	$effect(() => {
	});

	async function handleSwitchTeam(teamId: string) {
		if (teamId === currentTeam?.id) return;

		if (!switchTeam) {
			return;
		}

		const result = await switchTeam({ teamId });

		if (result.success) {
			await invalidateAll();
		} else {
			alert(result.message || 'Failed to switch team');
		}
	}

	async function handleSwitchCompany(companyId: string) {
		if (!switchCompany) {
			return;
		}

		const result = await switchCompany({ companyId });

		if (result.success) {
			await invalidateAll();
		} else {
			alert(result.message || 'Failed to switch company');
		}
	}

	async function handleClearContext() {
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
			const response = (await api.post('/users/impersonate', { type, id })) as any;
			toastStore.success(`Impersonating ${type}: ${response.data.entity.name}`);
			await invalidateAll();
			window.location.href = '/';
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || `Failed to impersonate ${type}`);
		}
	}

	// Determine display text and icon
	let displayText = $derived(
		activeCompany
			? activeCompany.name
			: currentTeam
				? currentTeam.name
				: isGod
					? 'God Mode'
					: isSuperAdmin
						? 'Super Admin'
						: 'Select Context'
	);

	let displayIcon = $derived(
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
					<span>God Mode (No Context)</span>
				</div>
				{#if !currentTeam && !activeCompany}
					<Check class="ml-2 size-4" />
				{/if}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
		{/if}

		{#if teams.length > 0}
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
			{#each teams as team}
				<DropdownMenu.Item
					onclick={() => handleSwitchTeam(team.id)}
					class="flex cursor-pointer items-center justify-between"
				>
					<div class="flex items-center gap-2 truncate">
						<Users class="size-3.5 text-muted-foreground shrink-0" />
						<span class="truncate">{team.name}</span>
						{#if team.personalTeam}
							<span class="text-xs text-muted-foreground">(Personal)</span>
						{/if}
					</div>
					{#if team.id === currentTeam?.id}
						<Check class="ml-2 size-4 shrink-0" />
					{/if}
				</DropdownMenu.Item>
			{/each}
			<DropdownMenu.Separator />
		{/if}

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

		{#if isGod && users.length > 0}
			<DropdownMenu.Label>
				<div class="flex items-center gap-2">
					<User class="size-4" />
					<span>Individuals</span>
					<span class="text-xs text-muted-foreground">({users.length})</span>
				</div>
			</DropdownMenu.Label>
			<DropdownMenu.Separator />
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
