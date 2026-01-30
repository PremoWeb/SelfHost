<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';

	const { navItems = [], title = 'Documentation' } = $props<{
		navItems: Array<{
			section: string;
			items: Array<{ title: string; path: string }>;
		}>;
		title?: string;
	}>();

	function isActive(path: string): boolean {
		return page.url.pathname === path || page.url.pathname === `${path}/`;
	}
</script>

<div class="space-y-8">
	<div>
		<h2 class="text-primary mb-1 text-lg font-bold tracking-tight">{title}</h2>
		<p class="text-muted-foreground text-xs">Everything you need to know.</p>
	</div>

	<nav class="space-y-6">
		{#each navItems as section}
			<div class="space-y-3">
				<h3 class="text-muted-foreground/50 text-xs font-bold tracking-widest uppercase">
					{section.section}
				</h3>
				<ul class="m-0 list-none space-y-1 p-0">
					{#each section.items as item}
						<li>
							<a
								href={item.path}
								class="block rounded-md px-3 py-2 text-sm transition-all {isActive(item.path)
									? 'bg-primary/10 text-primary font-medium shadow-sm'
									: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
							>
								{item.title}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</nav>
</div>
