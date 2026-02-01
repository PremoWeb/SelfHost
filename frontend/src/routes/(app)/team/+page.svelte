<script lang="ts">
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import type { PageData } from './$types';
	import { untrack } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Landmark, Users, Globe } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	let team = $state(untrack(() => data.team));
	$effect(() => {
		team = data.team;
	});
	let isSaving = $state(false);

	async function handleSave() {
		if (!team) return;
		isSaving = true;
		try {
			const { id, createdAt, updatedAt, ...payload } = team;
			const response = (await api.patch(`/teams/${team.id}`, payload)) as any;
			team = response.data.data;
			toastStore.success('Team updated');
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Update failed');
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b pb-6">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-bold tracking-tight">Team Settings</h1>
			<p class="text-muted-foreground">Manage your organization and collaborators.</p>
		</div>
		{#if team}
			<Button onclick={handleSave} disabled={isSaving}>
				{isSaving ? 'Saving...' : 'Save Settings'}
			</Button>
		{/if}
	</div>

	{#if team}
		<div class="flex flex-col gap-6">
			<nav class="flex gap-4 border-b">
				<a href="/team" class="border-primary border-b-2 px-4 py-2 text-sm font-medium">General</a>
				<a
					href="/team/members"
					class="text-muted-foreground hover:text-foreground px-4 py-2 text-sm font-medium"
					>Members</a
				>
			</nav>

			<Card.Root>
				<Card.Header>
					<Card.Title>Team Identity</Card.Title>
					<Card.Description>Primary profile for this workspace.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="name">Team Name</Label>
							<Input id="name" bind:value={team.name} required />
						</div>
						<div class="space-y-2">
							<Label for="description">Description</Label>
							<Input
								id="description"
								value={team.description ?? ''}
								oninput={(e) => {
									if (team) team.description = (e.target as HTMLInputElement).value;
								}}
							/>
						</div>
					</div>
					{#if team.personalTeam}
						<div class="bg-muted/50 text-muted-foreground rounded-lg p-4 text-xs">
							This is your personal workspace. Collaboration features are limited.
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	{:else}
		<Card.Root>
			<Card.Content class="py-12 text-center">
				<Users class="text-muted-foreground mx-auto mb-4 size-12" />
				<h3 class="mb-2 text-lg font-semibold">No Active Team</h3>
				<p class="text-muted-foreground mb-4 text-sm">
					You don't have an active team selected. As a God user, you can access all resources
					without a team, but team-specific features require selecting a team.
				</p>
				<p class="text-muted-foreground text-xs">
					Use the team switcher in the sidebar to select a team, or create a new team from the
					settings page.
				</p>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
