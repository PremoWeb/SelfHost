<script lang="ts">
    interface Props {
        children: any;
        class?: string;
    }
    let { children, class: className = '' }: Props = $props();
</script>

<tbody class="[&_tr:last-child]:border-0 {className}">
    {@render children()}
</tbody>
