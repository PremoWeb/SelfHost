<script lang="ts">
	import { page } from '$app/stores';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import { formatDate } from '$lib/utils/helpers';
	import Button from '$lib/components/forms/Button.svelte';
	import Input from '$lib/components/forms/Input.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/ui/table';
	import {
		Globe,
		Github,
		GitBranch,
		Settings,
		Cpu,
		Key,
		History,
		ExternalLink,
		Save,
		Play,
		Trash2,
		Plus,
		Layers
	} from '@lucide/svelte';
	import type { PageData } from './$types';
	import { onMount, untrack } from 'svelte';
	import type { EnvironmentVariable } from '$lib/types';
	import type { ApplicationEvent } from '$lib/types';
	import PageTitle from '$lib/components/PageTitle.svelte';

	let { data }: { data: PageData } = $props();

	// Helper to format app data from props
	function getAppData() {
		if (!data?.app) return null;
		return {
			...data.app,
			gitRepository: data.app.gitRepository ?? '',
			gitBranch: data.app.gitBranch ?? '',
			description: data.app.description ?? '',
			fqdn: data.app.fqdn ?? '',
			buildPack: data.app.buildPack ?? 'nixpacks'
		};
	}

	let app = $state(untrack(() => getAppData()));
	let variables = $state(untrack(() => data.variables || []));

	$effect(() => {
		const fresh = getAppData();
		if (fresh) {
			app = fresh;
		}
		variables = data.variables || [];
	});

	let isDeploying = $state(false);
	let isSaving = $state(false);

	// Env Var State
	let newVarKey = $state('');
	let newVarValue = $state('');
	let newVarIsBuildTime = $state(false);
	let isAddingVar = $state(false);

	async function handleDeploy() {
		isDeploying = true;
		try {
			// TODO: Implement deployment API
			await new Promise((resolve) => setTimeout(resolve, 2000));
			toastStore.success('Deployment queued');
		} catch (error) {
			toastStore.error('Failed to deploy');
		} finally {
			isDeploying = false;
		}
	}

	async function handleSave() {
		if (!app) return;
		isSaving = true;
		try {
			const {
				id,
				environmentId,
				destinationId,
				sourceId,
				s3StorageId,
				settings,
				createdAt,
				updatedAt,
				...payload
			} = app;
			const response = (await api.patch(`/applications/${app.id}`, payload)) as any;
			if (response.data.data) {
				app = response.data.data;
			}
			toastStore.success('Configuration saved');
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to save configuration');
		} finally {
			isSaving = false;
		}
	}

	async function handleAddVariable() {
		if (!app || !newVarKey || !newVarValue) return;
		isAddingVar = true;
		try {
			const response = (await api.post(`/applications/${app.id}/variables`, {
				key: newVarKey,
				value: newVarValue,
				isBuildTime: newVarIsBuildTime
			})) as any;

			// Optimistic / Server response update
			variables = [...variables, response.data.data];

			// Reset form
			newVarKey = '';
			newVarValue = '';
			newVarIsBuildTime = false;
			toastStore.success('Variable added');
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to add variable');
		} finally {
			isAddingVar = false;
		}
	}

	async function handleDeleteVariable(id: string) {
		if (!app) return;
		if (!confirm('Are you sure you want to delete this variable?')) return;
		try {
			await api.delete(`/applications/${app.id}/variables/${id}`);
			variables = variables.filter((v: EnvironmentVariable) => v.id !== id);
			toastStore.success('Variable deleted');
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to delete variable');
		}
	}

	// Realtime updates disabled
	onMount(() => {
		// No-op
	});
</script>

{#if app}
	<PageTitle title={app.name} />

	<div class="space-y-6">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div>
				<div class="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
					<a href="/projects" class="hover:text-foreground">Projects</a>
					<span>/</span>
					<a href="/projects/{$page.params.uuid}" class="hover:text-foreground">Project</a>
					<span>/</span>
					<span class="text-foreground">{app.name}</span>
				</div>
				<div class="flex items-center gap-3">
					<h1 class="text-3xl font-bold tracking-tight">{app.name}</h1>
					<Badge
						variant={app.status === 'running' ? 'default' : 'secondary'}
						class="h-6 px-2 capitalize"
					>
						{app.status}
					</Badge>
				</div>
			</div>
			<div class="flex gap-3">
				<Button variant="primary" loading={isDeploying} onclick={handleDeploy}>
					<Play class="mr-2 size-4" />
					Deploy
				</Button>
			</div>
		</div>

		<!-- Content -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			<!-- Main Info -->
			<div class="space-y-6 lg:col-span-2">
				<Card.Root>
					<Card.Header class="flex flex-row items-center justify-between space-y-0">
						<div>
							<Card.Title>Configuration</Card.Title>
							<Card.Description>Core application settings and deployment source.</Card.Description>
						</div>
						<Button variant="secondary" size="sm" loading={isSaving} onclick={handleSave}>
							<Save class="mr-2 size-4" />
							Save Changes
						</Button>
					</Card.Header>
					<Card.Content class="space-y-6 pt-4">
						<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
							<Input
								id="name"
								name="name"
								label="Name"
								value={app?.name || ''}
								oninput={(e) => {
									if (app) app.name = (e.target as HTMLInputElement).value;
								}}
								required
							/>
							<Input
								id="description"
								name="description"
								label="Description"
								value={app?.description || ''}
								oninput={(e) => {
									if (app) app.description = (e.target as HTMLInputElement).value;
								}}
							/>
						</div>

						<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
							<Input
								id="repository"
								name="repository"
								label="Repository"
								value={app?.gitRepository || ''}
								oninput={(e) => {
									if (app) app.gitRepository = (e.target as HTMLInputElement).value;
								}}
								required
							/>
							<Input
								id="branch"
								name="branch"
								label="Branch"
								value={app?.gitBranch || ''}
								oninput={(e) => {
									if (app) app.gitBranch = (e.target as HTMLInputElement).value;
								}}
								required
							/>
						</div>

						<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
							<div class="space-y-1">
								<Label for="buildPack">Build Pack</Label>
								<select
									id="buildPack"
									value={app?.buildPack || 'nixpacks'}
									onchange={(e) => {
										if (app) app.buildPack = (e.target as HTMLSelectElement).value;
									}}
									class="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
								>
									<option value="nixpacks">Nixpacks</option>
									<option value="dockerfile">Dockerfile</option>
									<option value="docker-compose">Docker Compose</option>
								</select>
							</div>
							<Input
								id="fqdn"
								name="fqdn"
								label="Domains (FQDN)"
								placeholder="https://app.example.com"
								value={app?.fqdn || ''}
								oninput={(e) => {
									if (app) app.fqdn = (e.target as HTMLInputElement).value;
								}}
							/>
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<div class="flex items-center gap-2">
							<Key class="text-muted-foreground size-4" />
							<Card.Title>Environment Variables</Card.Title>
						</div>
						<Card.Description
							>Secrets and configuration variables passed to your application.</Card.Description
						>
					</Card.Header>
					<Card.Content class="p-0">
						{#if variables.length > 0}
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Key</TableHead>
										<TableHead>Value</TableHead>
										<TableHead>Type</TableHead>
										<TableHead class="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{#each variables as variable}
										<TableRow>
											<TableCell class="font-mono text-xs">{variable.key}</TableCell>
											<TableCell
												class="text-muted-foreground max-w-[200px] truncate font-mono text-xs"
											>
												{variable.value}
											</TableCell>
											<TableCell>
												{#if variable.isBuildTime}
													<Badge
														variant="outline"
														class="bg-green-50 text-[10px] font-bold text-green-600 uppercase dark:bg-green-900/20"
														>Build</Badge
													>
												{:else}
													<Badge
														variant="outline"
														class="bg-blue-50 text-[10px] font-bold text-blue-600 uppercase dark:bg-blue-900/20"
														>Runtime</Badge
													>
												{/if}
											</TableCell>
											<TableCell class="text-right">
												<Button
													variant="ghost"
													size="sm"
													onclick={() => handleDeleteVariable(variable.id)}
													class="text-destructive hover:text-destructive hover:bg-destructive/10"
												>
													<Trash2 class="size-4" />
												</Button>
											</TableCell>
										</TableRow>
									{/each}
								</TableBody>
							</Table>
						{:else}
							<div class="text-muted-foreground py-10 text-center text-sm italic">
								No environment variables set
							</div>
						{/if}
					</Card.Content>
					<Card.Footer class="bg-muted/30 flex-col items-start gap-4 border-t pt-6">
						<h4 class="flex items-center gap-2 text-sm font-semibold">
							<Plus class="size-4" />
							Add New Variable
						</h4>
						<div class="grid w-full grid-cols-1 items-end gap-3 md:grid-cols-12">
							<div class="space-y-1.5 md:col-span-4">
								<Label for="new-key" class="text-xs">Key</Label>
								<Input
									id="new-key"
									name="new-key"
									bind:value={newVarKey}
									placeholder="API_KEY"
									class="h-9"
								/>
							</div>
							<div class="space-y-1.5 md:col-span-4">
								<Label for="new-value" class="text-xs">Value</Label>
								<Input
									id="new-value"
									name="new-value"
									bind:value={newVarValue}
									placeholder="secret-value"
									class="h-9"
								/>
							</div>
							<div class="flex items-center pb-2.5 md:col-span-2">
								<label class="flex cursor-pointer items-center gap-2 select-none">
									<input
										type="checkbox"
										bind:checked={newVarIsBuildTime}
										class="border-input bg-background rounded"
									/>
									<span class="text-muted-foreground text-xs">Build Time</span>
								</label>
							</div>
							<div class="md:col-span-2">
								<Button
									variant="secondary"
									size="sm"
									class="h-9 w-full"
									onclick={handleAddVariable}
									loading={isAddingVar}
									disabled={!newVarKey || !newVarValue}
								>
									Add
								</Button>
							</div>
						</div>
					</Card.Footer>
				</Card.Root>
			</div>

			<!-- Sidebar Info -->
			<div class="space-y-6">
				<Card.Root>
					<Card.Header>
						<div class="flex items-center gap-2">
							<History class="text-muted-foreground size-4" />
							<Card.Title class="text-base">History</Card.Title>
						</div>
					</Card.Header>
					<Card.Content>
						<div class="text-muted-foreground py-4 text-center text-sm italic">
							No deployments yet
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<div class="flex items-center gap-2">
							<ExternalLink class="text-muted-foreground size-4" />
							<Card.Title class="text-base">Links</Card.Title>
						</div>
					</Card.Header>
					<Card.Content>
						<div class="flex flex-col gap-2">
							{#if app.fqdn}
								<Button
									variant="outline"
									size="sm"
									href={app.fqdn}
									target="_blank"
									class="w-full justify-start"
								>
									<Globe class="mr-2 size-4" />
									Visit Site
								</Button>
							{/if}
							<Button
								variant="outline"
								size="sm"
								href={`https://github.com/${app.gitRepository}`}
								target="_blank"
								class="w-full justify-start"
							>
								<Github class="mr-2 size-4" />
								Repository
							</Button>
							<div class="flex flex-col gap-1 border-t pt-4">
								<div
									class="text-muted-foreground flex justify-between text-[10px] tracking-wider uppercase"
								>
									<span>Build Pack</span>
									<span class="text-foreground font-bold">{app.buildPack}</span>
								</div>
								<div
									class="text-muted-foreground flex justify-between text-[10px] tracking-wider uppercase"
								>
									<span>Branch</span>
									<span class="text-foreground font-bold">{app.gitBranch}</span>
								</div>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		</div>
	</div>
{:else}
	<div class="flex min-h-[400px] items-center justify-center">
		<div class="text-muted-foreground animate-pulse">Loading application...</div>
	</div>
{/if}
