<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';

	let { children, ref = $bindable(null), ...restProps }: TooltipPrimitive.TriggerProps = $props();
</script>

<TooltipPrimitive.Trigger bind:ref data-slot="tooltip-trigger" {...restProps}>
	{@render children?.()}
</TooltipPrimitive.Trigger>
