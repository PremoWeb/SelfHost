<script lang="ts">
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import type { PageData } from './$types';
	import { untrack } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import * as Dialog from '$lib/components/ui/dialog';
	import {
		Shield,
		Building2,
		Users,
		User,
		Settings as SettingsIcon,
		Plus,
		Edit,
		Trash2,
		Key,
		Crown,
		UserCog,
		Save,
		UserCheck,
		LogOut
	} from 'lucide-svelte';
	import { formatDate } from '$lib/utils/helpers';
	import { fade } from 'svelte/transition';

	let { data }: { data: PageData } = $props();

	let settings = $state(untrack(() => (data as any).settings || null));
	let activeTab = $state('instance');
	let isSaving = $state(false);
	let isRefreshing = $state(false);
	let dataKey = $state(0);

	// Management state
	let showCreateCompanyDialog = $state(false);
	let showCreateTeamDialog = $state(false);
	let showCreateUserDialog = $state(false);
	let showEditUserDialog = $state(false);
	let selectedCompany = $state<any>(null);
	let selectedTeam = $state<any>(null);
	let selectedUser = $state<any>(null);

	// Form states
	let newCompany = $state({ name: '', description: '', slug: '' });
	let newTeam = $state({ name: '', description: '' });
	let newUser = $state({ name: '', email: '', password: '', companyIds: [] as string[], teamIds: [] as string[] });
	let searchQuery = $state('');

	// Watch for data changes (e.g., from context switching)
	$effect(() => {
		const dataAny = data as any;
		if (dataAny.settings) {
			settings = dataAny.settings;
		}
		
		// Detect data changes by tracking a key
		const newKey = JSON.stringify({
			settings: dataAny.settings?.id,
			companies: dataAny.companies?.length,
			users: dataAny.users?.length,
			teams: dataAny.teams?.length
		});
		
		if (newKey !== dataKey.toString()) {
			isRefreshing = true;
			dataKey = Date.now();
			// Show loading overlay briefly for smooth transition
			setTimeout(() => {
				isRefreshing = false;
			}, 250);
		}
	});

	async function handleSave() {
		isSaving = true;
		try {
			const { id, createdAt, updatedAt, ...payload } = settings;
			const response = (await api.patch('/settings', payload)) as any;
			settings = response.data.data;
			toastStore.success('Settings synchronized');
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to sync');
		} finally {
			isSaving = false;
		}
	}

	async function handleCreateCompany() {
		try {
			const response = (await api.post('/companies', newCompany)) as any;
			toastStore.success('Company created successfully');
			showCreateCompanyDialog = false;
			newCompany = { name: '', description: '', slug: '' };
			// Refresh page data
			window.location.reload();
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to create company');
		}
	}

	async function handleCreateUser() {
		if (!newUser.name || !newUser.email || !newUser.password) {
			toastStore.error('All fields are required');
			return;
		}

		if (newUser.password.length < 8) {
			toastStore.error('Password must be at least 8 characters');
			return;
		}

		try {
			const response = (await api.post('/users', {
				name: newUser.name,
				email: newUser.email,
				password: newUser.password,
				companyIds: newUser.companyIds,
				teamIds: newUser.teamIds
			})) as any;
			toastStore.success('User created successfully');
			showCreateUserDialog = false;
			newUser = { name: '', email: '', password: '', companyIds: [], teamIds: [] };
			// Refresh page data
			window.location.reload();
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to create user');
		}
	}

	function toggleCompany(companyId: string) {
		if (newUser.companyIds.includes(companyId)) {
			newUser.companyIds = newUser.companyIds.filter((id) => id !== companyId);
		} else {
			newUser.companyIds = [...newUser.companyIds, companyId];
		}
	}

	function toggleTeam(teamId: string) {
		if (newUser.teamIds.includes(teamId)) {
			newUser.teamIds = newUser.teamIds.filter((id) => id !== teamId);
		} else {
			newUser.teamIds = [...newUser.teamIds, teamId];
		}
	}

	async function handleImpersonate(userId: string) {
		try {
			const response = (await api.post('/users/impersonate', { userId })) as any;
			toastStore.success('Impersonating user');
			// Reload page to apply impersonation
			window.location.href = '/';
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to impersonate user');
		}
	}

	async function handleStopImpersonating() {
		try {
			await api.delete('/users/impersonate');
			toastStore.success('Stopped impersonating');
			// Reload page to return to God user
			window.location.href = '/';
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to stop impersonation');
		}
	}

	async function handleAssignRole(userId: string, role: string) {
		try {
			// TODO: Implement role assignment API
			toastStore.success(`Role ${role} assigned to user`);
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to assign role');
		}
	}

	// Filter functions
	const filteredCompanies = $derived(
		(data as any).companies
			? (data as any).companies.filter(
					(c: any) =>
						c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
						c.slug?.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: []
	);

	const filteredUsers = $derived(
		(data as any).users
			? (data as any).users.filter(
					(u: any) =>
						u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
						u.email?.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: []
	);

	const filteredTeams = $derived(
		(data.teams ?? []).filter((t: any) => t.name?.toLowerCase().includes(searchQuery.toLowerCase()))
	);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b pb-6">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-bold tracking-tight">Settings</h1>
			<p class="text-muted-foreground">
				Manage system configuration, permissions, companies, teams, and users.
			</p>
		</div>
		{#if activeTab === 'instance' && settings}
			<Button onclick={handleSave} disabled={isSaving}>
				<Save class="mr-2 size-4" />
				{isSaving ? 'Saving...' : 'Save Settings'}
			</Button>
		{/if}
	</div>

	<Tabs.Root bind:value={activeTab} class="space-y-6">
		<Tabs.List class="h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
			<Tabs.Trigger
				value="instance"
				class="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:bg-transparent"
			>
				<SettingsIcon class="mr-2 size-4 inline" />
				Instance
			</Tabs.Trigger>
			{#if (data as any).canManage}
				<Tabs.Trigger
					value="permissions"
					class="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:bg-transparent"
				>
					<Shield class="mr-2 size-4 inline" />
					Permissions & Roles
				</Tabs.Trigger>
				<Tabs.Trigger
					value="companies"
					class="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:bg-transparent"
				>
					<Building2 class="mr-2 size-4 inline" />
					Companies
					{#if (data as any).companies && (data as any).companies.length > 0}
						<Badge variant="secondary" class="ml-2">{(data as any).companies.length}</Badge>
					{/if}
				</Tabs.Trigger>
				<Tabs.Trigger
					value="teams"
					class="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:bg-transparent"
				>
					<Users class="mr-2 size-4 inline" />
					Teams
					{#if data.teams && data.teams.length > 0}
						<Badge variant="secondary" class="ml-2">{data.teams.length}</Badge>
					{/if}
				</Tabs.Trigger>
				<Tabs.Trigger
					value="individuals"
					class="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:bg-transparent"
				>
					<User class="mr-2 size-4 inline" />
					Individuals
					{#if (data as any).users && (data as any).users.length > 0}
						<Badge variant="secondary" class="ml-2">{(data as any).users.length}</Badge>
					{/if}
				</Tabs.Trigger>
			{/if}
		</Tabs.List>

		<!-- Instance Settings Tab -->
		<Tabs.Content value="instance">
			{#if settings}
				<div class="grid gap-6 md:grid-cols-2">
					<Card.Root>
						<Card.Header>
							<Card.Title>Global Configuration</Card.Title>
							<Card.Description>Core behavior and network identity.</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-6">
							<div class="space-y-2">
								<Label for="fqdn">Instance FQDN</Label>
								<Input
									id="fqdn"
									value={settings.fqdn ?? ''}
									oninput={(e) => (settings.fqdn = (e.target as HTMLInputElement).value)}
									placeholder="https://app.example.com"
								/>
							</div>

							<div class="space-y-4 pt-2">
								<div class="flex items-center space-x-2">
									<Checkbox id="reg" bind:checked={settings.registrationEnabled} />
									<Label
										for="reg"
										class="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
										>Enable New Registrations</Label
									>
								</div>
								<div class="flex items-center space-x-2">
									<Checkbox id="dnt" bind:checked={settings.doNotTrack} />
									<Label
										for="dnt"
										class="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
										>Opt-out of Telemetry</Label
									>
								</div>
							</div>
						</Card.Content>
					</Card.Root>

					<Card.Root>
						<Card.Header>
							<Card.Title>System Identity</Card.Title>
							<Card.Description>Secure unique identifiers for this installation.</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-4">
							<div class="space-y-2">
								<Label>Instance Identifier</Label>
								<div class="bg-muted rounded-md p-4 font-mono text-xs break-all select-all">
									{settings.instanceId || 'NOT SET'}
								</div>
							</div>
							<p class="text-muted-foreground text-xs italic">
								This ID is used for licensing and official update channels.
							</p>
						</Card.Content>
					</Card.Root>
				</div>
			{:else}
				<div class="flex min-h-[400px] items-center justify-center">
					<div class="text-muted-foreground animate-pulse">Loading settings...</div>
				</div>
			{/if}
		</Tabs.Content>

		<!-- Permissions & Roles Tab -->
		{#if (data as any).canManage}
			<Tabs.Content value="permissions">
				<div class="space-y-6">
					<div class="flex items-center justify-between">
						<div class="flex flex-col gap-1">
							<h2 class="text-2xl font-semibold">Permissions & Roles</h2>
							<p class="text-muted-foreground">
								Manage Casbin policies, roles, and access control rules.
							</p>
						</div>
						{#if (data.user && data.user.isGod)}
							<Badge variant="default" class="gap-2">
								<Crown class="size-3" />
								God Mode
							</Badge>
						{/if}
					</div>

					<div class="grid gap-6 md:grid-cols-2">
						<Card.Root>
							<Card.Header>
								<Card.Title>System Roles</Card.Title>
								<Card.Description>Available roles in the system.</Card.Description>
							</Card.Header>
							<Card.Content>
								<div class="space-y-2">
									{#if Array.isArray((data.team as any)?.roles) && (data.team as any).roles.length > 0}
										{#each (data.team as any).roles as role}
											<div class="flex items-center justify-between rounded-md border p-3">
												<div class="flex items-center gap-2">
													<Key class="size-4 text-muted-foreground" />
													<span class="font-medium">{role}</span>
												</div>
												<Badge variant="secondary">{role}</Badge>
											</div>
										{/each}
									{:else}
										<p class="text-sm text-muted-foreground">No roles defined yet.</p>
									{/if}
								</div>
							</Card.Content>
						</Card.Root>

						<Card.Root>
							<Card.Header>
								<Card.Title>Casbin Policies</Card.Title>
								<Card.Description>View and manage access control policies.</Card.Description>
							</Card.Header>
							<Card.Content>
								{#if Array.isArray((data.team as any)?.casbinPolicies) && (data.team as any).casbinPolicies.length > 0}
									<div class="space-y-2 max-h-[400px] overflow-y-auto">
										{#each (data.team as any).casbinPolicies as policy}
											<div class="rounded-md border p-2 font-mono text-xs">
												<span class="text-muted-foreground">{policy.ptype}:</span>
												<span class="ml-2">
													{[policy.v0, policy.v1, policy.v2, policy.v3, policy.v4, policy.v5]
														.filter((v) => v)
														.join(', ')}
												</span>
											</div>
										{/each}
									</div>
								{:else}
									<p class="text-sm text-muted-foreground">No policies defined yet.</p>
								{/if}
							</Card.Content>
						</Card.Root>
					</div>
				</div>
			</Tabs.Content>

			<!-- Companies Tab -->
			<Tabs.Content value="companies">
				<div class="space-y-6">
					<div class="flex items-center justify-between">
						<div class="flex flex-col gap-1">
							<h2 class="text-2xl font-semibold">Company Management</h2>
							<p class="text-muted-foreground">Manage companies, members, and access control.</p>
						</div>
						<Button onclick={() => (showCreateCompanyDialog = true)}>
							<Plus class="mr-2 size-4" />
							Create Company
						</Button>
					</div>

					<div class="relative">
						<Input
							bind:value={searchQuery}
							placeholder="Search companies..."
							class="max-w-sm"
						/>
					</div>

					<Card.Root>
						{#if filteredCompanies && filteredCompanies.length > 0}
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>Company</Table.Head>
										<Table.Head>Slug</Table.Head>
										<Table.Head>Members</Table.Head>
										<Table.Head>Created By</Table.Head>
										<Table.Head>Created</Table.Head>
										<Table.Head class="text-right">Actions</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each filteredCompanies as company}
										<Table.Row>
											<Table.Cell>
												<div class="flex items-center gap-3">
													<div
														class="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full text-sm font-bold"
													>
														{company.name.charAt(0).toUpperCase()}
													</div>
													<div class="flex flex-col">
														<span class="font-medium">{company.name}</span>
														{#if company.description}
															<span class="text-xs text-muted-foreground">{company.description}</span>
														{/if}
													</div>
												</div>
											</Table.Cell>
											<Table.Cell>
												<code class="text-xs bg-muted px-2 py-1 rounded">{company.slug}</code>
											</Table.Cell>
											<Table.Cell>
												<Badge variant="secondary">
													{company.members?.length || 0} member{company.members?.length !== 1 ? 's' : ''}
												</Badge>
											</Table.Cell>
											<Table.Cell>
												<div class="text-sm">
													{company.createdBy?.name || company.createdBy?.email || 'Unknown'}
												</div>
											</Table.Cell>
											<Table.Cell class="text-sm text-muted-foreground">
												{#if company.createdAt}
													{formatDate(
														company.createdAt instanceof Date
															? company.createdAt.toISOString()
															: company.createdAt.toString()
													)}
												{:else}
													—
												{/if}
											</Table.Cell>
											<Table.Cell class="text-right">
												<div class="flex items-center justify-end gap-2">
													<Button variant="ghost" size="sm">
														<Edit class="size-4" />
													</Button>
													{#if data.user?.isGod}
														<Button variant="ghost" size="sm" class="text-destructive hover:text-destructive">
															<Trash2 class="size-4" />
														</Button>
													{/if}
												</div>
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						{:else}
							<Card.Content class="py-12 text-center">
								<Building2 class="mx-auto size-12 text-muted-foreground mb-4" />
								<h3 class="text-lg font-semibold mb-2">No Companies</h3>
								<p class="text-muted-foreground text-sm mb-4">
									Get started by creating your first company.
								</p>
								<Button onclick={() => (showCreateCompanyDialog = true)}>
									<Plus class="mr-2 size-4" />
									Create Company
								</Button>
							</Card.Content>
						{/if}
					</Card.Root>
				</div>
			</Tabs.Content>

			<!-- Teams Tab -->
			<Tabs.Content value="teams">
				<div class="space-y-6">
					<div class="flex items-center justify-between">
						<div class="flex flex-col gap-1">
							<h2 class="text-2xl font-semibold">Team Management</h2>
							<p class="text-muted-foreground">Manage teams and their members.</p>
						</div>
						<Button onclick={() => (showCreateTeamDialog = true)}>
							<Plus class="mr-2 size-4" />
							Create Team
						</Button>
					</div>

					<div class="relative">
						<Input bind:value={searchQuery} placeholder="Search teams..." class="max-w-sm" />
					</div>

					<Card.Root>
						{#if filteredTeams && filteredTeams.length > 0}
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>Team</Table.Head>
										<Table.Head>Company</Table.Head>
										<Table.Head>Members</Table.Head>
										<Table.Head>Type</Table.Head>
										<Table.Head>Created</Table.Head>
										<Table.Head class="text-right">Actions</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each filteredTeams as team}
										<Table.Row>
											<Table.Cell>
												<div class="flex items-center gap-3">
													<div
														class="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full text-sm font-bold"
													>
														{team.name.charAt(0).toUpperCase()}
													</div>
													<div class="flex flex-col">
														<span class="font-medium">{team.name}</span>
														{#if team.description}
															<span class="text-xs text-muted-foreground">{team.description}</span>
														{/if}
													</div>
												</div>
											</Table.Cell>
											<Table.Cell>
												{#if team.companyId}
													<Badge variant="outline">Linked</Badge>
												{:else}
													<span class="text-muted-foreground text-sm">—</span>
												{/if}
											</Table.Cell>
											<Table.Cell>
												<Badge variant="secondary">
													{team.members?.length || 0} member{team.members?.length !== 1 ? 's' : ''}
												</Badge>
											</Table.Cell>
											<Table.Cell>
												{#if team.personalTeam}
													<Badge variant="secondary">Personal</Badge>
												{:else}
													<Badge variant="outline">Team</Badge>
												{/if}
											</Table.Cell>
											<Table.Cell class="text-sm text-muted-foreground">
												{#if team.createdAt}
													{formatDate(
														team.createdAt instanceof Date
															? team.createdAt.toISOString()
															: team.createdAt.toString()
													)}
												{:else}
													—
												{/if}
											</Table.Cell>
											<Table.Cell class="text-right">
												<div class="flex items-center justify-end gap-2">
													<Button variant="ghost" size="sm">
														<Edit class="size-4" />
													</Button>
													{#if data.user?.isGod}
														<Button variant="ghost" size="sm" class="text-destructive hover:text-destructive">
															<Trash2 class="size-4" />
														</Button>
													{/if}
												</div>
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						{:else}
							<Card.Content class="py-12 text-center">
								<Users class="mx-auto size-12 text-muted-foreground mb-4" />
								<h3 class="text-lg font-semibold mb-2">No Teams</h3>
								<p class="text-muted-foreground text-sm mb-4">Get started by creating your first team.</p>
								<Button onclick={() => (showCreateTeamDialog = true)}>
									<Plus class="mr-2 size-4" />
									Create Team
								</Button>
							</Card.Content>
						{/if}
					</Card.Root>
				</div>
			</Tabs.Content>

			<!-- Individuals Tab -->
			<Tabs.Content value="individuals">
				<div class="space-y-6">
					<div class="flex items-center justify-between">
						<div class="flex flex-col gap-1">
							<h2 class="text-2xl font-semibold">User Management</h2>
							<p class="text-muted-foreground">Manage individual users, roles, and permissions.</p>
						</div>
						{#if data.user?.isGod}
							<Button onclick={() => (showCreateUserDialog = true)}>
								<Plus class="mr-2 size-4" />
								Create User
							</Button>
						{/if}
					</div>

					<div class="relative">
						<Input bind:value={searchQuery} placeholder="Search users..." class="max-w-sm" />
					</div>

					<Card.Root>
						{#if filteredUsers && filteredUsers.length > 0}
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>User</Table.Head>
										<Table.Head>Email</Table.Head>
										<Table.Head>Roles</Table.Head>
										<Table.Head>Status</Table.Head>
										<Table.Head>Joined</Table.Head>
										<Table.Head class="text-right">Actions</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each filteredUsers as user}
										<Table.Row>
											<Table.Cell>
												<div class="flex items-center gap-3">
													{#if user.image}
														<img
															src={user.image}
															alt={user.name}
															class="size-10 rounded-full"
														/>
													{:else}
														<div
															class="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full text-sm font-bold"
														>
															{user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
														</div>
													{/if}
													<div class="flex flex-col">
														<div class="flex items-center gap-2">
															<span class="font-medium">{user.name}</span>
															{#if user.isGod}
																<Badge variant="default" class="gap-1">
																	<Crown class="size-3" />
																	God
																</Badge>
															{/if}
														</div>
														{#if user.email}
															<span class="text-xs text-muted-foreground">{user.email}</span>
														{/if}
													</div>
												</div>
											</Table.Cell>
											<Table.Cell>
												<span class="text-sm">{user.email}</span>
											</Table.Cell>
											<Table.Cell>
												<div class="flex gap-1 flex-wrap">
													{#if user.isGod}
														<Badge variant="default" class="gap-1">
															<Crown class="size-3" />
															god
														</Badge>
													{/if}
													<!-- TODO: Fetch actual roles from Casbin for each user -->
												</div>
											</Table.Cell>
											<Table.Cell>
												{#if user.emailVerified}
													<Badge variant="default">Verified</Badge>
												{:else}
													<Badge variant="secondary">Unverified</Badge>
												{/if}
											</Table.Cell>
											<Table.Cell class="text-sm text-muted-foreground">
												{#if user.createdAt}
													{formatDate(
														user.createdAt instanceof Date
															? user.createdAt.toISOString()
															: user.createdAt.toString()
													)}
												{:else}
													—
												{/if}
											</Table.Cell>
											<Table.Cell class="text-right">
												<div class="flex items-center justify-end gap-2">
													{#if data.user?.isGod && !user.isGod && user.id !== data.user?.id}
														<Button
															variant="ghost"
															size="sm"
															onclick={() => handleImpersonate(user.id)}
															title="Impersonate this user"
														>
															<UserCheck class="size-4" />
														</Button>
													{/if}
													<Button variant="ghost" size="sm" onclick={() => {
														selectedUser = user;
														showEditUserDialog = true;
													}}>
														<UserCog class="size-4" />
													</Button>
													{#if data.user?.isGod && !user.isGod}
														<Button variant="ghost" size="sm" class="text-destructive hover:text-destructive">
															<Trash2 class="size-4" />
														</Button>
													{/if}
												</div>
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						{:else}
							<Card.Content class="py-12 text-center">
								<User class="mx-auto size-12 text-muted-foreground mb-4" />
								<h3 class="text-lg font-semibold mb-2">No Users</h3>
								<p class="text-muted-foreground text-sm mb-4">No users found in the system.</p>
								{#if data.user?.isGod}
									<Button onclick={() => (showCreateUserDialog = true)}>
										<Plus class="mr-2 size-4" />
										Create User
									</Button>
								{/if}
							</Card.Content>
						{/if}
					</Card.Root>
				</div>
			</Tabs.Content>
		{/if}
	</Tabs.Root>
</div>

<!-- Create User Dialog -->
<Dialog.Root bind:open={showCreateUserDialog}>
	<Dialog.Content class="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Create User</Dialog.Title>
			<Dialog.Description>Create a new user account. They will need to verify their email.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<Label for="user-name">Name</Label>
				<Input
					id="user-name"
					bind:value={newUser.name}
					placeholder="John Doe"
				/>
			</div>
			<div class="space-y-2">
				<Label for="user-email">Email</Label>
				<Input
					id="user-email"
					type="email"
					bind:value={newUser.email}
					placeholder="john@example.com"
				/>
			</div>
			<div class="space-y-2">
				<Label for="user-password">Password</Label>
				<Input
					id="user-password"
					type="password"
					bind:value={newUser.password}
					placeholder="Minimum 8 characters"
				/>
				<p class="text-xs text-muted-foreground">Password must be at least 8 characters long.</p>
			</div>

			<!-- Company Assignment -->
			{#if (data as any).companies && (data as any).companies.length > 0}
				<div class="space-y-2">
					<Label>Assign to Companies</Label>
					<div class="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
						{#each (data as any).companies as company}
							<div class="flex items-center space-x-2">
								<Checkbox
									id="company-{company.id}"
									checked={newUser.companyIds.includes(company.id)}
									onCheckedChange={() => toggleCompany(company.id)}
								/>
								<Label
									for="company-{company.id}"
									class="text-sm font-normal cursor-pointer flex-1"
								>
									{company.name}
									{#if company.slug}
										<span class="text-muted-foreground ml-2">({company.slug})</span>
									{/if}
								</Label>
							</div>
						{/each}
					</div>
					<p class="text-xs text-muted-foreground">Select companies to assign this user to.</p>
				</div>
			{/if}

			<!-- Team Assignment -->
			{#if data.teams && data.teams.length > 0}
				<div class="space-y-2">
					<Label>Assign to Teams</Label>
					<div class="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
						{#each data.teams as team}
							<div class="flex items-center space-x-2">
								<Checkbox
									id="team-{team.id}"
									checked={newUser.teamIds.includes(team.id)}
									onCheckedChange={() => toggleTeam(team.id)}
								/>
								<Label
									for="team-{team.id}"
									class="text-sm font-normal cursor-pointer flex-1"
								>
									{team.name}
									{#if team.personalTeam}
										<Badge variant="secondary" class="ml-2">Personal</Badge>
									{/if}
								</Label>
							</div>
						{/each}
					</div>
					<p class="text-xs text-muted-foreground">Select teams to assign this user to. A personal team will be created automatically.</p>
				</div>
			{/if}
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => {
				showCreateUserDialog = false;
				newUser = { name: '', email: '', password: '', companyIds: [], teamIds: [] };
			}}>Cancel</Button>
			<Button onclick={handleCreateUser}>Create User</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Create Company Dialog -->
<Dialog.Root bind:open={showCreateCompanyDialog}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Create Company</Dialog.Title>
			<Dialog.Description>Create a new company. You will become the owner.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<Label for="company-name">Company Name</Label>
				<Input
					id="company-name"
					bind:value={newCompany.name}
					placeholder="Acme Inc."
					oninput={(e) => {
						newCompany.name = (e.target as HTMLInputElement).value;
						if (!newCompany.slug) {
							newCompany.slug = newCompany.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
						}
					}}
				/>
			</div>
			<div class="space-y-2">
				<Label for="company-slug">Slug</Label>
				<Input
					id="company-slug"
					bind:value={newCompany.slug}
					placeholder="acme-inc"
				/>
			</div>
			<div class="space-y-2">
				<Label for="company-description">Description (Optional)</Label>
				<Input
					id="company-description"
					bind:value={newCompany.description}
					placeholder="A brief description..."
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showCreateCompanyDialog = false)}>Cancel</Button>
			<Button onclick={handleCreateCompany}>Create Company</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
