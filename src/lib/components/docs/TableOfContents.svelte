<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { pushState } from '$app/navigation';
	import type { Heading } from '$lib/utils/markdown';

	const { headings = [] } = $props<{
		headings?: Heading[];
	}>();

	let activeId = $state('');
	let observer: IntersectionObserver;
	const offset = 100;

	type NestedHeading = Heading & { children: Heading[] };

	const nestedHeadings = $derived.by(() => {
		const result: NestedHeading[] = [];
		const h2Stack: NestedHeading[] = [];

		headings.forEach((heading: Heading) => {
			if (heading.level === 2) {
				const newH2: NestedHeading = { ...heading, children: [] };
				h2Stack.push(newH2);
				result.push(newH2);
			} else if (heading.level === 3 && h2Stack.length > 0) {
				h2Stack[h2Stack.length - 1].children.push(heading);
			}
		});

		return result;
	});

	function setupObserver() {
		if (observer) observer.disconnect();

		const headingElements = headings
			.map((h: { id: string }) => document.getElementById(h.id))
			.filter(Boolean) as HTMLElement[];

		observer = new IntersectionObserver(
			(entries) => {
				const visibleEntries = entries.filter((e) => e.isIntersecting);
				if (visibleEntries.length > 0) {
					// Find the topmost visible heading
					const topMost = visibleEntries.reduce((prev, curr) =>
						curr.boundingClientRect.top < prev.boundingClientRect.top ? curr : prev
					);
					activeId = topMost.target.id;
				}
			},
			{
				rootMargin: '-10% 0% -80% 0%',
				threshold: 0
			}
		);

		headingElements.forEach((el) => observer.observe(el));
	}

	onMount(() => {
		setupObserver();
	});

	$effect(() => {
		if (headings.length > 0) {
			setupObserver();
		}
	});

	onDestroy(() => {
		if (observer) observer.disconnect();
	});

	function handleClick(e: MouseEvent, id: string) {
		e.preventDefault();
		const element = document.getElementById(id);
		if (element) {
			const top = element.getBoundingClientRect().top + window.scrollY - offset;
			window.scrollTo({ top, behavior: 'smooth' });
			pushState(`${page.url.pathname}#${id}`, {});
			activeId = id;
		}
	}
</script>

<div class="space-y-4">
	<p class="text-muted-foreground/70 text-xs font-bold tracking-wider uppercase">On this page</p>
	<nav class="relative">
		<div class="bg-border/50 absolute top-0 bottom-0 left-0 w-px"></div>
		<ul class="m-0 list-none space-y-1.5 p-0">
			{#each nestedHeadings as h2 (h2.id)}
				<li class="pl-4">
					<a
						href="#{h2.id}"
						class="hover:text-primary block text-sm transition-colors {activeId === h2.id
							? 'text-primary border-primary -ml-[17px] border-l-2 pl-[15px] font-medium'
							: 'text-muted-foreground'}"
						onclick={(e) => handleClick(e, h2.id)}
					>
						{h2.text}
					</a>
					{#if h2.children.length > 0}
						<ul class="border-border/30 m-0 mt-1.5 ml-2 list-none space-y-1.5 border-l p-0">
							{#each h2.children as h3 (h3.id)}
								<li class="pl-4">
									<a
										href="#{h3.id}"
										class="hover:text-primary block text-xs transition-colors {activeId === h3.id
											? 'text-primary border-primary -ml-[17px] border-l-2 pl-[15px] font-medium'
											: 'text-muted-foreground'}"
										onclick={(e) => handleClick(e, h3.id)}
									>
										{h3.text}
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>
</div>
