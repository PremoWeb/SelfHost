<script lang="ts">
    import type { HTMLThAttributes } from 'svelte/elements';

    interface Props extends HTMLThAttributes {
        children: any;
        class?: string;
    }
    let { children, class: className = '', ...rest }: Props = $props();
</script>

<th class="h-10 px-2 text-left align-middle font-medium text-neutral-500 dark:text-neutral-400 [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-[2px] {className}" {...rest}>
    {@render children()}
</th>
