<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';

	let { children, open = $bindable(false), ...restProps }: TooltipPrimitive.RootProps = $props();
</script>

<TooltipPrimitive.Root bind:open {...restProps}>
	{@render children?.()}
</TooltipPrimitive.Root>
