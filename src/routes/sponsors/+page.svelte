<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Heart, Github, Coffee, Building2, Sparkles, Check } from '@lucide/svelte';
	import { goto } from '$app/navigation';
</script>

<div class="min-h-screen bg-gradient-to-b from-background to-muted/20">
	<!-- Hero Section -->
	<section class="container mx-auto px-4 py-20 text-center">
		<div class="mx-auto max-w-4xl">
			<div class="mb-6 inline-flex items-center justify-center">
				<Heart class="text-primary mr-2 size-8 fill-current" />
			</div>
			<h1 class="mb-6 text-5xl font-bold tracking-tight md:text-6xl">
				Support <span class="text-primary">SelfHost.gg</span>
			</h1>
			<p class="text-muted-foreground mb-8 text-xl md:text-2xl">
				Help us build the future of self-hosted infrastructure. Every contribution makes a difference.
			</p>
			<div class="rounded-lg border bg-card/50 p-4 text-left">
				<p class="text-muted-foreground text-sm">
					<strong class="text-foreground">Note:</strong> SelfHost.gg is a new project in active development. 
					Your support helps us accelerate development, improve stability, and add new features faster.
				</p>
			</div>
		</div>
	</section>

	<!-- Sponsorship Tiers -->
	<section class="container mx-auto px-4 py-20">
		<div class="mx-auto max-w-6xl">
			<h2 class="mb-12 text-center text-3xl font-bold">Sponsorship Tiers</h2>
			<div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
				<!-- Supporter Tier -->
				<div class="rounded-lg border bg-card p-8">
					<div class="mb-4 flex items-center gap-2">
						<Coffee class="text-primary size-6" />
						<h3 class="text-2xl font-bold">Supporter</h3>
					</div>
					<div class="mb-6">
						<span class="text-4xl font-bold">$5</span>
						<span class="text-muted-foreground">/month</span>
					</div>
					<ul class="text-muted-foreground mb-8 space-y-3">
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Your name in our sponsors list</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Early access to new features</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Priority support in Discord</span>
						</li>
					</ul>
					<Button class="w-full" onclick={() => goto('https://github.com/sponsors/premoweb')}>
						Become a Supporter
					</Button>
				</div>

				<!-- Backer Tier -->
				<div class="border-primary rounded-lg border-2 bg-card p-8 shadow-lg">
					<div class="mb-4 flex items-center gap-2">
						<Sparkles class="text-primary size-6" />
						<h3 class="text-2xl font-bold">Backer</h3>
					</div>
					<div class="mb-6">
						<span class="text-4xl font-bold">$25</span>
						<span class="text-muted-foreground">/month</span>
					</div>
					<ul class="text-muted-foreground mb-8 space-y-3">
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Everything in Supporter tier</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Logo on sponsors page</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Feature request priority</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Monthly progress updates</span>
						</li>
					</ul>
					<Button class="w-full" onclick={() => goto('https://github.com/sponsors/premoweb')}>
						Become a Backer
					</Button>
				</div>

				<!-- Enterprise Tier -->
				<div class="rounded-lg border bg-card p-8">
					<div class="mb-4 flex items-center gap-2">
						<Building2 class="text-primary size-6" />
						<h3 class="text-2xl font-bold">Enterprise</h3>
					</div>
					<div class="mb-6">
						<span class="text-4xl font-bold">$100</span>
						<span class="text-muted-foreground">/month</span>
					</div>
					<ul class="text-muted-foreground mb-8 space-y-3">
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Everything in Backer tier</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Prominent logo placement</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Direct line to lead developer</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Custom feature development</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Dedicated support channel</span>
						</li>
					</ul>
					<Button class="w-full" onclick={() => goto('https://premoweb.com/contact')}>
						Contact Us
					</Button>
				</div>
			</div>
		</div>
	</section>

	<!-- Premium Sponsorship Tiers -->
	<section class="container mx-auto px-4 py-20">
		<div class="mx-auto max-w-6xl">
			<h2 class="mb-4 text-center text-3xl font-bold">Premium Sponsorship</h2>
			<p class="text-muted-foreground mb-12 text-center">
				For organizations and companies looking to make a significant impact
			</p>
			<div class="grid gap-8 md:grid-cols-2">
				<!-- Champion Tier -->
				<div class="border-primary/50 rounded-lg border-2 bg-gradient-to-br from-card to-muted/20 p-8 shadow-xl">
					<div class="mb-4 flex items-center gap-2">
						<Sparkles class="text-primary size-8" />
						<h3 class="text-3xl font-bold">Champion</h3>
					</div>
					<div class="mb-6">
						<span class="text-5xl font-bold">$500</span>
						<span class="text-muted-foreground">/month</span>
					</div>
					<ul class="text-muted-foreground mb-8 space-y-3">
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Everything in Enterprise tier</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Large logo on homepage</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Quarterly roadmap consultation</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Dedicated Discord channel</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Priority bug fixes</span>
						</li>
					</ul>
					<Button class="w-full" size="lg" onclick={() => goto('https://premoweb.com/contact')}>
						Contact Us
					</Button>
				</div>

				<!-- Platinum Tier -->
				<div class="border-primary rounded-lg border-2 bg-gradient-to-br from-primary/5 to-card p-8 shadow-2xl">
					<div class="mb-2">
						<span class="bg-primary text-primary-foreground rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider">
							Premium
						</span>
					</div>
					<div class="mb-4 flex items-center gap-2">
						<Building2 class="text-primary size-8" />
						<h3 class="text-3xl font-bold">Platinum</h3>
					</div>
					<div class="mb-6">
						<span class="text-5xl font-bold">$1,000</span>
						<span class="text-muted-foreground">/month</span>
					</div>
					<ul class="text-muted-foreground mb-8 space-y-3">
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Everything in Champion tier</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Hero placement on homepage</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Monthly 1-on-1 with lead developer</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Guaranteed feature development</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>White-glove onboarding support</span>
						</li>
						<li class="flex items-start gap-2">
							<Check class="text-primary mt-0.5 size-5 flex-shrink-0" />
							<span>Custom integration development</span>
						</li>
					</ul>
					<Button class="w-full" size="lg" onclick={() => goto('https://premoweb.com/contact')}>
						Contact Us
					</Button>
				</div>
			</div>
		</div>
	</section>

	<!-- Other Ways to Support -->
	<section class="container mx-auto px-4 py-20">
		<div class="mx-auto max-w-4xl">
			<h2 class="mb-12 text-center text-3xl font-bold">Other Ways to Support</h2>
			<div class="grid gap-8 md:grid-cols-2">
				<div class="rounded-lg border bg-card p-6">
					<Github class="text-primary mb-4 size-8" />
					<h3 class="mb-2 text-xl font-semibold">Contribute Code</h3>
					<p class="text-muted-foreground mb-4">
						Help us build SelfHost.gg by contributing code, fixing bugs, or adding new features.
					</p>
					<Button variant="outline" onclick={() => goto('https://github.com/premoweb/selfhost')}>
						View on GitHub
					</Button>
				</div>

				<div class="rounded-lg border bg-card p-6">
					<Heart class="text-primary mb-4 size-8" />
					<h3 class="mb-2 text-xl font-semibold">Spread the Word</h3>
					<p class="text-muted-foreground mb-4">
						Share SelfHost.gg with others who might benefit from self-hosted infrastructure.
					</p>
					<Button variant="outline" onclick={() => goto('https://x.com/maietta')}>
						Follow on X
					</Button>
				</div>
			</div>
		</div>
	</section>

	<!-- Current Sponsors -->
	<section class="container mx-auto px-4 py-20">
		<div class="mx-auto max-w-4xl">
			<h2 class="mb-12 text-center text-3xl font-bold">Our Sponsors</h2>
			<div class="rounded-lg border bg-card p-12 text-center">
				<p class="text-muted-foreground mb-4">
					Be the first to sponsor SelfHost.gg! As a new project, we're just getting started.
				</p>
				<p class="text-muted-foreground text-sm">
					Your support helps us build faster, add more features, and create a better self-hosting experience for everyone.
				</p>
			</div>
		</div>
	</section>

	<!-- CTA Section -->
	<section class="container mx-auto px-4 py-20">
		<div class="mx-auto max-w-4xl rounded-lg border bg-card p-12 text-center">
			<h2 class="mb-4 text-3xl font-bold">Ready to Support SelfHost.gg?</h2>
			<p class="text-muted-foreground mb-8 text-lg">
				Every contribution, big or small, helps us build the future of self-hosted infrastructure.
			</p>
			<div class="flex flex-col gap-4 sm:flex-row sm:justify-center">
				<Button size="lg" onclick={() => goto('https://github.com/sponsors/premoweb')}>
					<Heart class="mr-2 size-4 fill-current" />
					Sponsor on GitHub
				</Button>
				<Button size="lg" variant="outline" onclick={() => goto('/docs')}>
					Learn More
				</Button>
			</div>
		</div>
	</section>
</div>
