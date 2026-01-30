<script lang="ts">
	interface Props {
        children: any;
        class?: string;
    }
    let { children, class: className = '' }: Props = $props();
</script>

<thead class="[&_tr]:border-b {className}">
    {@render children()}
</thead>
