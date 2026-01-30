<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Optional additional classes for the sticky container */
		class?: string;
		/** Whether to show the bottom border */
		showBorder?: boolean;
		/** Content to display in the header */
		children: Snippet;
	}

	let { 
		class: className = '',
		showBorder = true,
		children
	}: Props = $props();
</script>

<div class="sticky top-0 z-10 bg-background pb-4 -mx-8 px-8 pt-6 -mt-6 {showBorder ? 'border-b' : ''} {className}">
	{@render children()}
</div>
