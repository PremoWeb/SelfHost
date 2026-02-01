<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { GitBranch, GitCommit, X } from 'lucide-svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';

	let events = $state<any[]>([]);
	let isExpanded = $state(false);
	let eventSource: EventSource | null = null;

	onMount(() => {
		if (!browser) return;
		
		// Connect to SSE endpoint with error handling
		try {
			eventSource = new EventSource('/api/webhooks/events');

			eventSource.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					events = [data, ...events].slice(0, 10); // Keep last 10 events
				} catch (e) {
					// Ignore ping messages and invalid JSON
				}
			};

			eventSource.onerror = (error) => {
				// Silently handle errors - connection might be refused if not authenticated
				// or if the endpoint is unavailable
				if (eventSource?.readyState === EventSource.CLOSED) {
					// Connection closed, don't try to reconnect automatically
					eventSource.close();
					eventSource = null;
				}
			};
		} catch (error) {
			// Silently fail if EventSource is not supported or connection fails
		}
	});

	onDestroy(() => {
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
	});

	function formatTime(timestamp: string) {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);

		if (seconds < 60) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return date.toLocaleDateString();
	}
</script>

{#if events.length > 0}
	<div class="fixed right-4 bottom-20 z-50">
		{#if isExpanded}
			<Card.Root class="w-80 shadow-lg border-2">
				<Card.Header class="pb-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<GitCommit class="size-4" />
							<Card.Title class="text-sm">Recent Activity</Card.Title>
						</div>
						<Button variant="ghost" size="icon" class="h-6 w-6" onclick={() => isExpanded = false}>
							<X class="size-3" />
						</Button>
					</div>
				</Card.Header>
				<Card.Content class="space-y-2 max-h-96 overflow-y-auto">
					{#each events as event}
						<div class="p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors">
							<div class="flex items-start gap-2">
								<GitBranch class="size-3 mt-0.5 shrink-0 text-muted-foreground" />
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-1">
										<span class="text-xs font-medium truncate">{event.repo}</span>
										<Badge variant="outline" class="text-[10px] h-4 px-1">{event.branch}</Badge>
									</div>
									<p class="text-[11px] text-muted-foreground truncate mb-1">
										{event.commitMessage}
									</p>
									<div class="flex items-center gap-2 text-[10px] text-muted-foreground">
										<span class="font-mono">{event.commit}</span>
										<span>•</span>
										<span>{event.author}</span>
										<span>•</span>
										<span>{formatTime(event.timestamp)}</span>
									</div>
								</div>
							</div>
						</div>
					{/each}
				</Card.Content>
			</Card.Root>
		{:else}
			<button
				onclick={() => isExpanded = true}
				class="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg hover:bg-primary/90 transition-all animate-in slide-in-from-bottom-2"
			>
				<GitCommit class="size-4" />
				<span class="text-sm font-medium">{events.length} new event{events.length > 1 ? 's' : ''}</span>
			</button>
		{/if}
	</div>
{/if}
