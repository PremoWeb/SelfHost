<script lang="ts">
    import { Menu } from "@lucide/svelte";
    import { Button } from "$lib/components/ui/button";

	interface Props {
		sidebarOpen: boolean;
	}

	let { sidebarOpen = $bindable(false) }: Props = $props();
</script>

<div class="sticky top-0 z-[40] flex items-center justify-between px-6 py-4 lg:hidden bg-background/80 backdrop-blur-md border-b">
    <div class="flex items-center gap-3">
        <a href="/" class="text-xl font-black uppercase tracking-tighter hover:opacity-80 transition-opacity">PremoHost</a>
    </div>
    <Button 
        variant="ghost" 
        size="icon" 
        onclick={() => (sidebarOpen = !sidebarOpen)}
        class="rounded-xl border hover:bg-muted"
    >
        <span class="sr-only">Open sidebar</span>
        <Menu class="size-6" />
    </Button>
</div>
