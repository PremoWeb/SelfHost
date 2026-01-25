<script lang="ts">
	interface Props {
		class?: string;
        width?: string;
        height?: string;
        variant?: 'text' | 'circular' | 'rectangular';
	}

	let { class: className = '', width, height, variant = 'rectangular' }: Props = $props();
    
    // Default styles
    let baseStyles = "animate-pulse bg-gray-200 dark:bg-gray-700 rounded";
    
    /* 
       Dynamic styles based on variant
       circular -> rounded-full
    */
</script>

<div
	class="{baseStyles} {variant === 'circular' ? 'rounded-full' : ''} {className}"
	style:width={width}
	style:height={height}
>
    <span class="sr-only">Loading...</span>
</div>
