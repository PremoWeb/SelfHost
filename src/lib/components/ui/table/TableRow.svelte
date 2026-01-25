<script lang="ts">
    interface Props {
        children: any;
        class?: string;
        onclick?: () => void;
    }
    let { children, class: className = '', onclick }: Props = $props();
</script>

<tr 
    class="border-b transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50 data-[state=selected]:bg-blue-50 dark:data-[state=selected]:bg-neutral-800 {className}"
    {onclick}
>
    {@render children()}
</tr>
