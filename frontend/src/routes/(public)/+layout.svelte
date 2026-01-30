<script lang="ts">
	let { data, children } = $props();
</script>

<!-- Minimal public layout - no sidebar, no app chrome -->
<div class="min-h-screen">
	{@render children?.()}
</div>
