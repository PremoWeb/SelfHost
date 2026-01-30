<script lang="ts">
	interface Props {
		children: any;
		class?: string;
	}
	let { children, class: className = '' }: Props = $props();
</script>

<div class="relative w-full overflow-auto">
	<table class="w-full caption-bottom text-sm {className}">
		{@render children()}
	</table>
</div>
