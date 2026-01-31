<script lang="ts">
	import type { PageData } from './$types';
	import DocLayout from '$lib/components/docs/DocLayout.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';

	let { data }: { data: PageData } = $props();

	const title = $derived(data?.title ?? 'Documentation');
	const content = $derived(data?.content ?? '');
	const navItems = $derived(data?.navItems ?? []);
	const showPublicHeader = $derived(data?.showPublicHeader ?? false);
</script>

<PageTitle title="{title} - Documentation" />

{#if data}
	<DocLayout
		{content}
		{title}
		{navItems}
		{showPublicHeader}
	/>
{:else}
	<div class="container mx-auto px-4 py-12">
		<div class="text-muted-foreground flex items-center justify-center gap-2 py-20">
			<div class="border-primary size-6 animate-spin rounded-full border-b-2"></div>
			<span>Loading documentation...</span>
		</div>
	</div>
{/if}
