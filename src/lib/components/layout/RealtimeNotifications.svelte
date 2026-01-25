<script lang="ts">
	import { onMount } from 'svelte';

	import { toastStore } from '$lib/stores/toast';

	interface Props {
		teamId: string | number;
	}

	let { teamId }: Props = $props();

	onMount(() => {
		// Realtime notifications disabled
	});
</script>
