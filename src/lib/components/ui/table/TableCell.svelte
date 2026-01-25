<script lang="ts">
    import type { HTMLTdAttributes } from 'svelte/elements';

    interface Props extends HTMLTdAttributes {
        children: any;
        class?: string;
    }
    let { children, class: className = '', ...rest }: Props = $props();
</script>

<td class="p-2 align-middle [&:has([role=checkbox])]:pr-0 *:[role=checkbox]:translate-y-[2px] {className}" {...rest}>
    {@render children()}
</td>
