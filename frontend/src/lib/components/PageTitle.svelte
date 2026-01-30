<script lang="ts">
	interface Props {
		title?: string;
	}

	let { title }: Props = $props();

	const baseTitle = 'SelfHost.gg';
	const fullTitle = $derived(title ? `${title} - ${baseTitle}` : `${baseTitle} – Self-Hosting for the Greater Good`);
</script>

<svelte:head>
	<title>{fullTitle}</title>
</svelte:head>
