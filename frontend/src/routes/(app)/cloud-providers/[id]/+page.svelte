<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { toastStore } from '$lib/stores/toast';
	import { getVpsPlans } from '../../vps.remote';

	// Guard: ensure load provided provider (avoid crash on bad route or API error)
	function ensureData(
		data: PageData
	): asserts data is PageData & { provider: NonNullable<PageData['provider']> } {
		if (!data?.provider) throw new Error('Provider not found');
	}
	import {
		Server,
		Key,
		Plus,
		ArrowLeft,
		ShieldCheck,
		Trash2,
		Save,
		FileText,
		Loader2,
		ChevronRight
	} from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import * as Dialog from '$lib/components/ui/dialog';
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/ui/table';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let { data } = $props<{ data: PageData }>();

	let showCreateModal = $state(false);
	let showSaveTemplateDialog = $state(false);
	let selectedRegion = $state('');
	let selectedPlan = $state('');
	let selectedOs = $state('387'); // Default to Ubuntu 22.04 LTS
	let selectedSshKeys = $state<string[]>([]);
	let serverLabel = $state('');
	let templateName = $state('');
	let templateDescription = $state('');

	let installingKeyId = $state<string | null>(null);
	let removingKeyId = $state<string | null>(null);
	let deletingTemplateId = $state<string | null>(null);
	let isSavingTemplate = $state(false);
	let isDeploying = $state(false);

	let plansPromise = $state<Promise<any[]>>(Promise.resolve([]));

	function handleRegionChange() {
		if (!selectedRegion) {
			plansPromise = Promise.resolve([]);
			return;
		}

		plansPromise = getVpsPlans({ regionId: selectedRegion, providerId: data.provider.id })
			.then(async (response) => {
				const res = response as { success?: boolean; data?: { plans?: unknown[] } };
				if (res.success && res.data) {
					const plans = res.data.plans || [];

					// Validate selected plan availability
					if (selectedPlan && !plans.some((p: any) => p.id === selectedPlan)) {
						selectedPlan = '';
						toastStore.info('Selected plan not available in this region');
					}
					return plans;
				}
				toastStore.error('Failed to load available plans');
				return [];
			})
			.catch((error) => {
				toastStore.error('Failed to load available plans');
				return [];
			});
	}

	function loadTemplate(template: any) {
		selectedRegion = template.region;
		selectedPlan = template.plan;
		selectedOs = template.osId.toString();
		selectedSshKeys = template.sshKeyIds || [];
		showCreateModal = true;

		handleRegionChange();

		toastStore.success(`Loaded template: ${template.name}`);
	}

	function resetForm() {
		selectedRegion = '';
		selectedPlan = '';
		selectedOs = '387';
		selectedSshKeys = [];
		serverLabel = '';
		plansPromise = Promise.resolve([]);
	}
</script>

{#snippet providerKeyRow(key: any)}
	<TableRow>
		<TableCell class="font-medium">{key.name}</TableCell>
		<TableCell class="text-right">
			<form
				method="POST"
				action="?/removeKey"
				use:enhance={() => {
					removingKeyId = key.id;
					return async ({ result }) => {
						removingKeyId = null;
						if (result.type === 'success') {
							toastStore.success('SSH Key removed');
							await invalidateAll();
						} else if (result.type === 'failure') {
							toastStore.error((result.data?.error as string) || 'Failed to remove SSH Key');
						} else if (result.type === 'error') {
							toastStore.error('An unexpected error occurred');
						}
					};
				}}
			>
				<input type="hidden" name="providerSshKeyId" value={key.id} />
				<Button
					type="submit"
					variant="ghost"
					size="icon"
					disabled={removingKeyId === key.id}
					class="text-destructive hover:text-destructive hover:bg-destructive/10"
				>
					<Trash2 class="size-4" />
				</Button>
			</form>
		</TableCell>
	</TableRow>
{/snippet}

{#snippet teamKeyRow(key: any, providerKeys: any[])}
	{@const isInstalled = providerKeys.some((pk: any) => pk.name === key.name)}
	<TableRow>
		<TableCell class="font-medium">{key.name}</TableCell>
		<TableCell class="text-right">
			{#if isInstalled}
				<Badge variant="secondary" class="gap-1">
					<ShieldCheck class="size-3" />
					Installed
				</Badge>
			{:else}
				<form
					method="POST"
					action="?/installKey"
					use:enhance={() => {
						installingKeyId = key.id;
						return async ({ result }) => {
							installingKeyId = null;
							if (result.type === 'success') {
								toastStore.success('SSH Key installed');
								await invalidateAll();
							} else if (result.type === 'failure') {
								toastStore.error((result.data?.error as string) || 'Failed to install SSH Key');
							} else if (result.type === 'error') {
								toastStore.error('An unexpected error occurred');
							}
						};
					}}
				>
					<input type="hidden" name="privateKeyId" value={key.id} />
					<Button type="submit" variant="outline" size="sm" disabled={installingKeyId === key.id}>
						{installingKeyId === key.id ? 'Installing...' : 'Install'}
					</Button>
				</form>
			{/if}
		</TableCell>
	</TableRow>
{/snippet}

{#snippet templateRow(template: any)}
	<TableRow>
		<TableCell class="font-medium">{template.name}</TableCell>
		<TableCell class="text-muted-foreground">
			{template.description || '—'}
		</TableCell>
		<TableCell class="text-right">
			<div class="flex items-center justify-end gap-2">
				<Button variant="outline" size="sm" onclick={() => loadTemplate(template)}>Load</Button>
				<form
					method="POST"
					action="?/deleteTemplate"
					use:enhance={() => {
						deletingTemplateId = template.id;
						return async ({ result }) => {
							deletingTemplateId = null;
							if (result.type === 'success') {
								toastStore.success('Template deleted');
								await invalidateAll();
							} else if (result.type === 'failure') {
								toastStore.error((result.data?.error as string) || 'Failed to delete template');
							} else if (result.type === 'error') {
								toastStore.error('An unexpected error occurred');
							}
						};
					}}
				>
					<input type="hidden" name="templateId" value={template.id} />
					<Button
						type="submit"
						variant="ghost"
						size="icon"
						disabled={deletingTemplateId === template.id}
						class="text-destructive hover:text-destructive hover:bg-destructive/10"
					>
						<Trash2 class="size-4" />
					</Button>
				</form>
			</div>
		</TableCell>
	</TableRow>
{/snippet}

{#if !data?.provider}
	<div class="text-muted-foreground flex flex-col items-center justify-center gap-4 py-16">
		<p>Provider not found or still loading.</p>
		<Button href="/cloud-providers" variant="outline">Back to Cloud Providers</Button>
	</div>
{:else}
	<div class="space-y-6">
		<!-- Page Header -->
		<div class="flex items-center gap-4">
			<Button href="/cloud-providers" variant="ghost" size="icon">
				<ArrowLeft class="size-4" />
			</Button>
			<div class="flex-1">
				<div class="text-muted-foreground flex items-center gap-2 text-sm">
					<a href="/cloud-providers" class="hover:underline">Cloud Providers</a>
					<ChevronRight class="size-3" />
					<span>{data.provider.name}</span>
				</div>
				<div class="mt-1 flex items-center gap-3">
					<h1 class="text-3xl font-bold tracking-tight">{data.provider.name}</h1>
					<Badge variant="secondary" class="capitalize">{data.provider.type}</Badge>
					<div class="ml-2 flex items-center gap-1.5">
						{#if data.provider.dnsEnabled}
							<Badge
								variant="outline"
								class="border-green-500 bg-green-500/10 px-1.5 py-0 text-[10px] text-green-600 uppercase"
								>DNS</Badge
							>
						{/if}
						<Badge variant="outline" class="px-1.5 py-0 text-[10px] uppercase">
							{data.provider.server_count || 0} Servers
						</Badge>
						<Badge
							variant="secondary"
							class="border-blue-200 bg-blue-100/50 px-1.5 py-0 text-[10px] text-blue-700 uppercase"
						>
							{data.provider.application_count || 0} Apps
						</Badge>
						<Badge
							variant="secondary"
							class="border-purple-200 bg-purple-100/50 px-1.5 py-0 text-[10px] text-purple-700 uppercase"
						>
							{data.provider.database_count || 0} DBs
						</Badge>
						<Badge
							variant="secondary"
							class="border-orange-200 bg-orange-100/50 px-1.5 py-0 text-[10px] text-orange-700 uppercase"
						>
							{data.provider.domain_count || 0} Zones
						</Badge>
					</div>
				</div>
			</div>
			<Button onclick={() => (showCreateModal = true)}>
				<Plus class="mr-2 size-4" />
				Deploy VPS
			</Button>
		</div>

		<!-- Cloud Instances -->
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<h2 class="text-lg font-semibold">Cloud Instances</h2>
					{#await data.streamed.instances}
						<Loader2 class="text-muted-foreground size-4 animate-spin" />
					{:then instances}
						<Badge variant="secondary">{instances.length} Active</Badge>
					{/await}
				</div>
			</div>

			<Card.Root>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Instance</TableHead>
							<TableHead>Specs</TableHead>
							<TableHead>Region</TableHead>
							<TableHead>Status</TableHead>
							<TableHead class="text-right">Resources / Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#await data.streamed.instances}
							<TableRow>
								<TableCell colspan={5} class="text-muted-foreground h-32 text-center">
									<Loader2 class="mx-auto mb-2 size-8 animate-spin opacity-20" />
									<p>Loading instances...</p>
								</TableCell>
							</TableRow>
						{:then instances}
							{#each instances as instance}
								{@const isImported = data.servers.some((s: any) => s.ip === instance.main_ip)}
								{@const server = data.servers.find((s: any) => s.ip === instance.main_ip)}
								<TableRow>
									<TableCell class="font-medium">
										<div class="space-y-1">
											<div class="flex items-center gap-2">
												<Server class="text-muted-foreground size-4" />
												<span>{instance.label || instance.id}</span>
											</div>
											<code class="text-muted-foreground font-mono text-[10px]"
												>{instance.main_ip}</code
											>
										</div>
									</TableCell>
									<TableCell>
										<div class="text-muted-foreground flex flex-col text-xs">
											<span>{instance.vcpu_count} vCPU</span>
											<span>{instance.ram} MB RAM</span>
										</div>
									</TableCell>
									<TableCell>
										<span class="text-muted-foreground text-xs">{instance.region}</span>
									</TableCell>
									<TableCell>
										<Badge
											variant={instance.status === 'active' ? 'default' : 'secondary'}
											class="text-[10px] capitalize"
										>
											{instance.status}
										</Badge>
									</TableCell>
									<TableCell class="text-right">
										<div class="flex items-center justify-end gap-3">
											{#if isImported}
												<Badge
													variant="secondary"
													class="gap-1.5 border-green-200 bg-green-50 text-[10px] whitespace-nowrap text-green-700"
												>
													<ShieldCheck class="size-3" />
													{server?.application_count || 0} Apps / {server?.database_count || 0} DBs
												</Badge>
											{:else}
												<Button variant="outline" size="sm" class="h-8">Import</Button>
											{/if}
										</div>
									</TableCell>
								</TableRow>
							{:else}
								<TableRow>
									<TableCell colspan={5} class="h-32 text-center text-muted-foreground">
										<Server class="size-8 mx-auto mb-2 opacity-20" />
										<p>No active instances found</p>
									</TableCell>
								</TableRow>
							{/each}
						{:catch}
							<TableRow>
								<TableCell colspan={5} class="text-destructive h-32 text-center">
									<p>Failed to load instances.</p>
								</TableCell>
							</TableRow>
						{/await}
					</TableBody>
				</Table>
			</Card.Root>
		</div>

		<div class="grid gap-6 lg:grid-cols-2">
			<!-- SSH Keys on Provider -->
			<Card.Root>
				<Card.Header>
					<Card.Title>SSH Keys on Provider</Card.Title>
					<Card.Description>Keys currently installed on {data.provider.name}</Card.Description>
				</Card.Header>
				<Card.Content>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead class="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#await data.streamed.providerSshKeys}
								<TableRow>
									<TableCell colspan={2} class="text-muted-foreground h-24 text-center">
										<Loader2 class="mx-auto mb-2 size-5 animate-spin opacity-50" />
										Loading keys...
									</TableCell>
								</TableRow>
							{:then keys}
								{#each keys as key}
									{@render providerKeyRow(key)}
								{:else}
									<TableRow>
										<TableCell colspan={2} class="h-24 text-center text-muted-foreground">
											No keys on provider
										</TableCell>
									</TableRow>
								{/each}
							{:catch}
								<TableRow>
									<TableCell colspan={2} class="text-destructive h-24 text-center">
										Failed to load keys
									</TableCell>
								</TableRow>
							{/await}
						</TableBody>
					</Table>
				</Card.Content>
			</Card.Root>

			<!-- Team SSH Keys to Install -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Team SSH Keys</Card.Title>
					<Card.Description>Install your team's SSH keys to this provider</Card.Description>
				</Card.Header>
				<Card.Content>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead class="text-right">Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#await data.streamed.providerSshKeys}
								{#each data.teamPrivateKeys as key}
									<TableRow>
										<TableCell class="font-medium">{key.name}</TableCell>
										<TableCell class="text-muted-foreground text-right text-xs"
											>Checking...</TableCell
										>
									</TableRow>
								{/each}
							{:then providerKeys}
								{#each data.teamPrivateKeys as key}
									{@render teamKeyRow(key, providerKeys)}
								{/each}
							{/await}
						</TableBody>
					</Table>
				</Card.Content>
			</Card.Root>

			<!-- VPS Templates -->
			<Card.Root class="lg:col-span-2">
				<Card.Header>
					<Card.Title>VPS Templates</Card.Title>
					<Card.Description>Quick deploy configurations</Card.Description>
				</Card.Header>
				<Card.Content>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Description</TableHead>
								<TableHead class="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each data.templates as template}
								{@render templateRow(template)}
							{:else}
								<TableRow>
									<TableCell colspan={3} class="h-24 text-center text-muted-foreground">
										No templates saved yet
									</TableCell>
								</TableRow>
							{/each}
						</TableBody>
					</Table>
				</Card.Content>
			</Card.Root>
		</div>
	</div>

	<!-- Deploy Modal -->
	<Dialog.Root bind:open={showCreateModal}>
		<Dialog.Content class="sm:max-w-2xl">
			<Dialog.Header>
				<Dialog.Title>Deploy New VPS</Dialog.Title>
				<Dialog.Description>
					Deploy a new virtual private server on {data.provider.name}
				</Dialog.Description>
			</Dialog.Header>
			<form
				method="POST"
				action="?/deploy"
				class="space-y-4 pt-4"
				use:enhance={() => {
					isDeploying = true;
					return async ({ result }) => {
						isDeploying = false;
						if (result.type === 'success') {
							toastStore.success('VPS deployment started');
							showCreateModal = false;
							resetForm();
							await invalidateAll();
						} else if (result.type === 'failure') {
							toastStore.error((result.data?.error as string) || 'Failed to deploy VPS');
						} else if (result.type === 'error') {
							toastStore.error('An unexpected error occurred');
						}
					};
				}}
			>
				{#if data.templates.length > 0}
					<div class="space-y-2 border-b pb-4">
						<Label for="template">Load from Template (Optional)</Label>
						<select
							id="template"
							onchange={(e) => {
								const templateId = (e.target as HTMLSelectElement).value;
								if (templateId) {
									const template = data.templates.find((t: any) => t.id === templateId);
									if (template) {
										loadTemplate(template);
										(e.target as HTMLSelectElement).value = '';
									}
								}
							}}
							class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
						>
							<option value="">Select a template...</option>
							{#each data.templates as template}
								<option value={template.id}>{template.name}</option>
							{/each}
						</select>
						<p class="text-muted-foreground text-xs">
							Choose a saved configuration to auto-fill the form below
						</p>
					</div>
				{/if}

				<div class="space-y-2">
					<Label for="serverLabel">Server Label</Label>
					<Input
						id="serverLabel"
						name="label"
						bind:value={serverLabel}
						placeholder="my-server"
						required
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-1">
						<Label for="region">Region</Label>
						{#await data.streamed.meta}
							<div
								class="bg-background border-input text-muted-foreground flex h-10 w-full items-center rounded-md border px-3 text-sm"
							>
								<Loader2 class="mr-2 size-3 animate-spin" /> Loading regions...
							</div>
						{:then meta}
							<select
								id="region"
								name="region"
								bind:value={selectedRegion}
								onchange={handleRegionChange}
								class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
								required
							>
								<option value="">Select Region</option>
								{#each meta.regions as region}
									<option value={region.id}>{region.city} ({region.id})</option>
								{/each}
							</select>
						{:catch}
							<div
								class="bg-background border-input text-destructive flex h-10 w-full items-center rounded-md border px-3 text-sm"
							>
								Failed to load
							</div>
						{/await}
					</div>
					<div class="space-y-2">
						<Label for="plan" class="flex items-center gap-2">
							Server Size
							{#await plansPromise}
								<Loader2 class="size-3 animate-spin" />
							{/await}
						</Label>
						<select
							id="plan"
							name="plan"
							bind:value={selectedPlan}
							disabled={!selectedRegion}
							class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
							required
						>
							{#await plansPromise}
								<option value="">Loading plans...</option>
							{:then availablePlans}
								{#await data.streamed.meta}
									<option value="">Loading defaults...</option>
								{:then meta}
									{@const activePlans =
										!selectedRegion || availablePlans.length === 0 ? meta.plans : availablePlans}
									{@const filtered = activePlans.filter(
										(p: any) => p.type === 'vc2' || p.type === 'vps'
									)}
									<option value="">{selectedRegion ? 'Select Plan' : 'Select region first'}</option>
									{#each filtered as plan}
										<option value={plan.id}>{plan.ram}MB RAM - ${plan.monthly_cost}/mo</option>
									{/each}
								{/await}
							{:catch}
								<option value="">Error loading plans</option>
							{/await}
						</select>
					</div>
				</div>

				<div class="space-y-1">
					<Label for="os">Operating System</Label>
					<div class="relative">
						{#await data.streamed.meta}
							<div
								class="bg-background border-input text-muted-foreground flex h-10 w-full items-center rounded-md border px-3 text-sm"
							>
								<Loader2 class="mr-2 size-3 animate-spin" /> Loading OS options...
							</div>
						{:then meta}
							<select
								id="os"
								name="osId"
								bind:value={selectedOs}
								class="bg-background border-input h-10 w-full rounded-md border px-3 text-sm"
								required
							>
								{#each meta.os as os}
									<option value={os.id}>{os.name}</option>
								{/each}
							</select>
						{:catch}
							<div
								class="bg-background border-input text-destructive flex h-10 w-full items-center rounded-md border px-3 text-sm"
							>
								Failed to load options
							</div>
						{/await}
					</div>
				</div>

				<div class="space-y-2">
					<Label>SSH Keys (Optional)</Label>
					<div class="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
						{#await data.streamed.providerSshKeys}
							<div class="flex items-center justify-center p-4">
								<Loader2 class="text-muted-foreground size-4 animate-spin" />
							</div>
						{:then keys}
							{#each keys as key}
								<label class="flex cursor-pointer items-center gap-2">
									<input
										type="checkbox"
										name="sshKeys"
										value={key.id}
										bind:group={selectedSshKeys}
										class="rounded"
									/>
									<span class="text-sm">{key.name}</span>
								</label>
							{:else}
								<p class="text-sm text-muted-foreground">No SSH keys found.</p>
							{/each}
						{:catch}
							<p class="text-destructive text-sm">Failed to load keys.</p>
						{/await}
					</div>
				</div>

				<Dialog.Footer class="gap-2">
					<Button type="button" variant="secondary" onclick={() => (showSaveTemplateDialog = true)}>
						<Save class="mr-2 size-4" />
						Save as Template
					</Button>
					<Button type="submit" disabled={isDeploying}>
						{isDeploying ? 'Deploying...' : 'Deploy Now'}
					</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Root>

	<!-- Save Template Dialog -->
	<Dialog.Root bind:open={showSaveTemplateDialog}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>Save as Template</Dialog.Title>
				<Dialog.Description
					>Save current configuration for quick deployment later</Dialog.Description
				>
			</Dialog.Header>
			<form
				method="POST"
				action="?/saveTemplate"
				class="space-y-4 pt-4"
				use:enhance={() => {
					isSavingTemplate = true;
					return async ({ result }) => {
						isSavingTemplate = false;
						if (result.type === 'success') {
							toastStore.success('Template saved');
							showSaveTemplateDialog = false;
							templateName = '';
							templateDescription = '';
							await invalidateAll();
						} else if (result.type === 'failure') {
							toastStore.error((result.data?.error as string) || 'Failed to save template');
						} else if (result.type === 'error') {
							toastStore.error('An unexpected error occurred');
						}
					};
				}}
			>
				<input type="hidden" name="region" value={selectedRegion} />
				<input type="hidden" name="plan" value={selectedPlan} />
				<input type="hidden" name="osId" value={selectedOs} />
				{#each selectedSshKeys as keyId}
					<input type="hidden" name="sshKeys" value={keyId} />
				{/each}

				<div class="space-y-2">
					<Label for="templateName">Template Name</Label>
					<Input
						id="templateName"
						name="templateName"
						bind:value={templateName}
						placeholder="Production Server"
						required
					/>
				</div>

				<div class="space-y-2">
					<Label for="templateDescription">Description (Optional)</Label>
					<Input
						id="templateDescription"
						name="templateDescription"
						bind:value={templateDescription}
						placeholder="Standard production configuration"
					/>
				</div>

				<Dialog.Footer>
					<Button type="submit" disabled={isSavingTemplate}>
						{isSavingTemplate ? 'Saving...' : 'Save Template'}
					</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Root>
{/if}
