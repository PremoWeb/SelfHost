<script lang="ts">
	import { onMount } from 'svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import '../app.css';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	import { ModeWatcher } from 'mode-watcher';
	import { setupViewTransition } from 'sveltekit-view-transition';

	let { data, children }: { data?: any; children: any } = $props();

	setupViewTransition();

	// WebSocket initialization removed
	onMount(() => {
		// No-op
	});
</script>

<ModeWatcher />
<PageTitle />
<svelte:head>
	<meta name="description" content="Self-hostable cloud infrastructure management" />
</svelte:head>

<div class="dark:bg-base min-h-screen bg-white transition-colors duration-300">
	<!-- Toast notifications -->
	<Toast />

	<!-- Main content -->
	<main>
		<Tooltip.Provider>
		{@render children()}
		</Tooltip.Provider>
	</main>
</div>
