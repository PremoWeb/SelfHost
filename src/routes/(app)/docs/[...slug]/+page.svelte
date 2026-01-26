<script lang="ts">
	import type { PageData } from './$types';
	import DocLayout from '$lib/components/docs/DocLayout.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';

	let { data }: { data: PageData } = $props();
</script>

<PageTitle title="{data.title} - Documentation" />

<DocLayout 
	content={data.content} 
	title={data.title} 
	navItems={data.navItems}
	showPublicHeader={data.showPublicHeader || false}
/>
