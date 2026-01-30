<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { LogIn } from '@lucide/svelte';

	const navItems = [
		{ label: 'About', href: '/' },
		{ label: 'Documentation', href: '/docs' },
		{ label: 'FAQs', href: '/docs/faqs' },
		{ label: 'Sponsors', href: '/sponsors' }
	];
</script>

<header class="border-border bg-background/95 sticky top-0 z-50 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-background/60">
	<div class="container mx-auto flex h-16 items-center justify-between px-4">
		<!-- Logo -->
		<div 
			class="flex flex-col justify-center hover:opacity-80 transition-opacity cursor-pointer"
			onclick={() => goto('/')}
			role="button"
			tabindex="0"
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					goto('/');
				}
			}}
		>
			<div class="text-lg leading-none font-bold">SelfHost.gg</div>
			<div class="text-muted-foreground mt-1 text-[10px]">
				by <a
					href="https://premoweb.com?utm_source=selfhost&utm_medium=logo&utm_campaign=selfhost"
					target="_blank"
					rel="noopener noreferrer"
					onclick={(e) => e.stopPropagation()}
					class="text-primary/80 hover:underline">PremoWeb LLC</a
				>
			</div>
		</div>

		<!-- Navigation -->
		<nav class="hidden md:flex items-center gap-6">
			{#each navItems as item}
				<a
					href={item.href}
					class="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
				>
					{item.label}
				</a>
			{/each}
		</nav>

		<!-- Actions -->
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="sm" onclick={() => goto('/login')}>
				<LogIn class="mr-2 size-4" />
				Sign In
			</Button>
			<Button size="sm" onclick={() => goto('/register')}>
				Get Started
			</Button>
		</div>
	</div>
</header>
