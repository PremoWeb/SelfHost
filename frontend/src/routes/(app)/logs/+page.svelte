<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Search, Filter, X, ChevronLeft, ChevronRight, Eye, Calendar } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/helpers';

	let { data }: { data: PageData } = $props();

	let showFilters = $state(false);
	let showDetails = $state<string | null>(null);
	let showDetailsDialog = $state(false);
	let selectedLog = $state<any>(null);

	// Extract initial filter values (intentionally capturing initial values)
	const initialFilters = untrack(() => ({
		userId: data.filters.userId || '',
		action: data.filters.action || '',
		resourceType: data.filters.resourceType || '',
		resourceId: data.filters.resourceId || '',
		teamId: data.filters.teamId || '',
		companyId: data.filters.companyId || '',
		impersonatedBy: data.filters.impersonatedBy || '',
		successFilter: data.filters.success !== undefined ? String(data.filters.success) : '',
		startDate: data.filters.startDate || '',
		endDate: data.filters.endDate || ''
	}));

	// Filter state
	let userId = $state(initialFilters.userId);
	let action = $state(initialFilters.action);
	let resourceType = $state(initialFilters.resourceType);
	let resourceId = $state(initialFilters.resourceId);
	let teamId = $state(initialFilters.teamId);
	let companyId = $state(initialFilters.companyId);
	let impersonatedBy = $state(initialFilters.impersonatedBy);
	let successFilter = $state<string>(initialFilters.successFilter);
	let startDate = $state(initialFilters.startDate);
	let endDate = $state(initialFilters.endDate);

	function applyFilters() {
		const params = new URLSearchParams();
		
		if (userId) params.set('userId', userId);
		if (action) params.set('action', action);
		if (resourceType) params.set('resourceType', resourceType);
		if (resourceId) params.set('resourceId', resourceId);
		if (teamId) params.set('teamId', teamId);
		if (companyId) params.set('companyId', companyId);
		if (impersonatedBy) params.set('impersonatedBy', impersonatedBy);
		if (successFilter && successFilter !== '') params.set('success', successFilter);
		if (startDate) params.set('startDate', startDate);
		if (endDate) params.set('endDate', endDate);
		
		// Reset to page 1 when filtering
		params.set('page', '1');
		
		goto(`/logs?${params.toString()}`);
	}

	function clearFilters() {
		userId = '';
		action = '';
		resourceType = '';
		resourceId = '';
		teamId = '';
		companyId = '';
		impersonatedBy = '';
		successFilter = '';
		startDate = '';
		endDate = '';
		applyFilters();
	}

	function viewDetails(log: any) {
		selectedLog = log;
		showDetails = log.id;
		showDetailsDialog = true;
	}

	function getActionBadgeVariant(action: string) {
		if (action.includes('create')) return 'default';
		if (action.includes('update')) return 'default';
		if (action.includes('delete')) return 'destructive';
		if (action.includes('impersonate') || action.includes('switch')) return 'default';
		return 'secondary';
	}

	function getSuccessBadgeVariant(success: boolean) {
		return success ? 'default' : 'destructive';
	}

	function formatAction(action: string): string {
		return action.replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase());
	}

	function nextPage() {
		const currentPage = parseInt(page.url.searchParams.get('page') || '1', 10);
		const params = new URLSearchParams(page.url.searchParams);
		params.set('page', String(currentPage + 1));
		goto(`/logs?${params.toString()}`);
	}

	function prevPage() {
		const currentPage = parseInt(page.url.searchParams.get('page') || '1', 10);
		if (currentPage > 1) {
			const params = new URLSearchParams(page.url.searchParams);
			params.set('page', String(currentPage - 1));
			goto(`/logs?${params.toString()}`);
		}
	}
</script>

<PageTitle title="Action Logs" />

<div class="space-y-6">
	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between">
				<div>
					<Card.Title>Action Logs</Card.Title>
					<Card.Description>View and filter all actions taken in the UI</Card.Description>
				</div>
				<Button variant="outline" onclick={() => (showFilters = !showFilters)}>
					<Filter class="mr-2 size-4" />
					Filters
				</Button>
			</div>
		</Card.Header>

		{#if showFilters}
			<Card.Content>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					<div class="space-y-2">
						<Label for="userId">User ID</Label>
						<Input id="userId" bind:value={userId} placeholder="Filter by user ID" />
					</div>
					<div class="space-y-2">
						<Label for="action">Action</Label>
						<Input id="action" bind:value={action} placeholder="e.g., project.create" />
					</div>
					<div class="space-y-2">
						<Label for="resourceType">Resource Type</Label>
						<Input id="resourceType" bind:value={resourceType} placeholder="e.g., project, server" />
					</div>
					<div class="space-y-2">
						<Label for="resourceId">Resource ID</Label>
						<Input id="resourceId" bind:value={resourceId} placeholder="Filter by resource ID" />
					</div>
					<div class="space-y-2">
						<Label for="teamId">Team ID</Label>
						<Input id="teamId" bind:value={teamId} placeholder="Filter by team ID" />
					</div>
					<div class="space-y-2">
						<Label for="companyId">Company ID</Label>
						<Input id="companyId" bind:value={companyId} placeholder="Filter by company ID" />
					</div>
					<div class="space-y-2">
						<Label for="impersonatedBy">Impersonated By</Label>
						<Input id="impersonatedBy" bind:value={impersonatedBy} placeholder="Filter by impersonator" />
					</div>
					<div class="space-y-2">
						<Label for="success">Success</Label>
						<select
							id="success"
							bind:value={successFilter}
							class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
						>
							<option value="">All</option>
							<option value="true">Success</option>
							<option value="false">Failed</option>
						</select>
					</div>
					<div class="space-y-2">
						<Label for="startDate">Start Date</Label>
						<Input id="startDate" type="date" bind:value={startDate} />
					</div>
					<div class="space-y-2">
						<Label for="endDate">End Date</Label>
						<Input id="endDate" type="date" bind:value={endDate} />
					</div>
				</div>
				<div class="flex gap-2 mt-4">
					<Button onclick={applyFilters}>Apply Filters</Button>
					<Button variant="outline" onclick={clearFilters}>
						<X class="mr-2 size-4" />
						Clear
					</Button>
				</div>
			</Card.Content>
		{/if}

		<Card.Content>
			<div class="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Timestamp</TableHead>
							<TableHead>User</TableHead>
							<TableHead>Action</TableHead>
							<TableHead>Resource</TableHead>
							<TableHead>Context</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Details</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#if data.logs.length === 0}
							<TableRow>
								<TableCell colspan="7" class="text-center text-muted-foreground py-8">
									No logs found
								</TableCell>
							</TableRow>
						{:else}
							{#each data.logs as log}
								<TableRow>
									<TableCell class="font-mono text-xs">
										{formatDate(new Date(log.createdAt * 1000))}
									</TableCell>
									<TableCell>
										<div class="flex flex-col">
											<span class="font-medium">{log.userName || log.userEmail || 'Unknown'}</span>
											{#if log.impersonatedBy}
												<span class="text-xs text-muted-foreground">
													Impersonated by: {log.impersonatedBy}
												</span>
											{/if}
										</div>
									</TableCell>
									<TableCell>
										<Badge variant={getActionBadgeVariant(log.action)}>
											{formatAction(log.action)}
										</Badge>
									</TableCell>
									<TableCell>
										{#if log.resourceType}
											<div class="flex flex-col">
												<span class="text-sm font-medium">{log.resourceType}</span>
												{#if log.resourceId}
													<span class="text-xs text-muted-foreground font-mono">
														{log.resourceId.substring(0, 8)}...
													</span>
												{/if}
											</div>
										{:else}
											<span class="text-muted-foreground">—</span>
										{/if}
									</TableCell>
									<TableCell>
										<div class="flex flex-col gap-1">
											{#if log.teamId}
												<span class="text-xs">Team: {log.teamId.substring(0, 8)}...</span>
											{/if}
											{#if log.companyId}
												<span class="text-xs">Company: {log.companyId.substring(0, 8)}...</span>
											{/if}
											{#if log.impersonationType}
												<span class="text-xs text-muted-foreground">
													{log.impersonationType} context
												</span>
											{/if}
										</div>
									</TableCell>
									<TableCell>
										<Badge variant={getSuccessBadgeVariant(log.success)}>
											{log.success ? 'Success' : 'Failed'}
										</Badge>
										{#if log.errorMessage}
											<div class="text-xs text-destructive mt-1">{log.errorMessage}</div>
										{/if}
									</TableCell>
									<TableCell>
										<Button variant="ghost" size="sm" onclick={() => viewDetails(log)}>
											<Eye class="size-4" />
										</Button>
									</TableCell>
								</TableRow>
							{/each}
						{/if}
					</TableBody>
				</Table>
			</div>

			<!-- Pagination -->
			<div class="flex items-center justify-between mt-4">
				<div class="text-sm text-muted-foreground">
					Page {data.pagination.page} {data.pagination.hasMore ? '(showing more available)' : ''}
				</div>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" onclick={prevPage} disabled={data.pagination.page === 1}>
						<ChevronLeft class="size-4" />
						Previous
					</Button>
					<Button variant="outline" size="sm" onclick={nextPage} disabled={!data.pagination.hasMore}>
						Next
						<ChevronRight class="size-4" />
					</Button>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>

<!-- Details Dialog -->
<Dialog.Root bind:open={showDetailsDialog}>
	<Dialog.Content class="max-w-4xl max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Log Details</Dialog.Title>
			<Dialog.Description>Full details of the action log entry</Dialog.Description>
		</Dialog.Header>
		{#if selectedLog}
			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<Label class="text-xs text-muted-foreground">ID</Label>
						<div class="font-mono text-sm">{selectedLog.id}</div>
					</div>
					<div>
						<Label class="text-xs text-muted-foreground">Timestamp</Label>
						<div class="text-sm">{formatDate(new Date(selectedLog.createdAt * 1000))}</div>
					</div>
					<div>
						<Label class="text-xs text-muted-foreground">User</Label>
						<div class="text-sm">{selectedLog.userName || selectedLog.userEmail || selectedLog.userId}</div>
					</div>
					<div>
						<Label class="text-xs text-muted-foreground">Action</Label>
						<div class="text-sm">{selectedLog.action}</div>
					</div>
					<div>
						<Label class="text-xs text-muted-foreground">Method</Label>
						<div class="text-sm">{selectedLog.method}</div>
					</div>
					<div>
						<Label class="text-xs text-muted-foreground">Path</Label>
						<div class="text-sm font-mono">{selectedLog.path}</div>
					</div>
					<div>
						<Label class="text-xs text-muted-foreground">IP Address</Label>
						<div class="text-sm font-mono">{selectedLog.ipAddress || '—'}</div>
					</div>
					<div>
						<Label class="text-xs text-muted-foreground">User Agent</Label>
						<div class="text-sm text-xs break-all">{selectedLog.userAgent || '—'}</div>
					</div>
				</div>

				{#if selectedLog.impersonatedBy}
					<div class="border-t pt-4">
						<Label class="text-xs text-muted-foreground">Impersonation Context</Label>
						<div class="mt-2 space-y-1">
							<div class="text-sm">Impersonated By: {selectedLog.impersonatedBy}</div>
							{#if selectedLog.impersonationType}
								<div class="text-sm">Type: {selectedLog.impersonationType}</div>
							{/if}
							{#if selectedLog.impersonationEntityId}
								<div class="text-sm">Entity ID: {selectedLog.impersonationEntityId}</div>
							{/if}
						</div>
					</div>
				{/if}

				{#if selectedLog.resourceType || selectedLog.resourceId}
					<div class="border-t pt-4">
						<Label class="text-xs text-muted-foreground">Resource</Label>
						<div class="mt-2 space-y-1">
							{#if selectedLog.resourceType}
								<div class="text-sm">Type: {selectedLog.resourceType}</div>
							{/if}
							{#if selectedLog.resourceId}
								<div class="text-sm font-mono">ID: {selectedLog.resourceId}</div>
							{/if}
						</div>
					</div>
				{/if}

				{#if selectedLog.teamId || selectedLog.companyId}
					<div class="border-t pt-4">
						<Label class="text-xs text-muted-foreground">Context</Label>
						<div class="mt-2 space-y-1">
							{#if selectedLog.teamId}
								<div class="text-sm font-mono">Team: {selectedLog.teamId}</div>
							{/if}
							{#if selectedLog.companyId}
								<div class="text-sm font-mono">Company: {selectedLog.companyId}</div>
							{/if}
						</div>
					</div>
				{/if}

				{#if selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0}
					<div class="border-t pt-4">
						<Label class="text-xs text-muted-foreground">Metadata</Label>
						<pre class="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto">{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
					</div>
				{/if}

				{#if selectedLog.requestBody && Object.keys(selectedLog.requestBody).length > 0}
					<div class="border-t pt-4">
						<Label class="text-xs text-muted-foreground">Request Body</Label>
						<pre class="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto">{JSON.stringify(selectedLog.requestBody, null, 2)}</pre>
					</div>
				{/if}

				{#if selectedLog.errorMessage}
					<div class="border-t pt-4">
						<Label class="text-xs text-muted-foreground text-destructive">Error Message</Label>
						<div class="mt-2 p-3 bg-destructive/10 rounded-md text-sm text-destructive">
							{selectedLog.errorMessage}
						</div>
					</div>
				{/if}
			</div>
		{/if}
		<Dialog.Footer>
			<Button onclick={() => {
				showDetailsDialog = false;
				showDetails = null;
				selectedLog = null;
			}}>Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
