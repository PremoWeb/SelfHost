<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ArrowRight, Rocket, Shield, Zap, Globe, Code2, Server } from '@lucide/svelte';
	import { goto } from '$app/navigation';
</script>

<div class="min-h-screen bg-gradient-to-b from-background to-muted/20">
	<!-- Hero Section -->
	<section class="container mx-auto px-4 py-20 text-center">
		<div class="mx-auto max-w-4xl">
			<h1 class="mb-6 text-5xl font-bold tracking-tight md:text-6xl">
				Self-Hosting for the
				<span class="text-primary">Greater Good</span>
			</h1>
			<p class="text-muted-foreground mb-8 text-xl md:text-2xl">
				Take control of your infrastructure with a modern, open-source deployment platform.
				Deploy, manage, and scale your applications on your own servers.
			</p>
			<div class="flex flex-col gap-4 sm:flex-row sm:justify-center">
				<Button size="lg" onclick={() => goto('/docs')}>
					Get Started
					<ArrowRight class="ml-2 size-4" />
				</Button>
				<Button size="lg" variant="outline" onclick={() => goto('/docs')}>
					View Documentation
				</Button>
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section class="container mx-auto px-4 py-20">
		<div class="mx-auto max-w-6xl">
			<h2 class="mb-12 text-center text-3xl font-bold">Why SelfHost?</h2>
			<div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
				<div class="rounded-lg border bg-card p-6">
					<Server class="text-primary mb-4 size-8" />
					<h3 class="mb-2 text-xl font-semibold">Full Control</h3>
					<p class="text-muted-foreground">
						Your data, your servers, your rules. No vendor lock-in, no platform tax.
					</p>
				</div>
				<div class="rounded-lg border bg-card p-6">
					<Zap class="text-primary mb-4 size-8" />
					<h3 class="mb-2 text-xl font-semibold">Lightning Fast</h3>
					<p class="text-muted-foreground">
						Built with SvelteKit for real-time responsiveness and superior performance.
					</p>
				</div>
				<div class="rounded-lg border bg-card p-6">
					<Shield class="text-primary mb-4 size-8" />
					<h3 class="mb-2 text-xl font-semibold">Secure by Default</h3>
					<p class="text-muted-foreground">
						Industry-standard encryption, SSH key management, and comprehensive audit logging.
					</p>
				</div>
				<div class="rounded-lg border bg-card p-6">
					<Code2 class="text-primary mb-4 size-8" />
					<h3 class="mb-2 text-xl font-semibold">Git Integration</h3>
					<p class="text-muted-foreground">
						Built-in Git hosting with automatic deployments from GitHub, GitLab, or Bitbucket.
					</p>
				</div>
				<div class="rounded-lg border bg-card p-6">
					<Globe class="text-primary mb-4 size-8" />
					<h3 class="mb-2 text-xl font-semibold">Multi-Cloud</h3>
					<p class="text-muted-foreground">
						Connect with Vultr, DigitalOcean, AWS, or bring your own bare-metal servers.
					</p>
				</div>
				<div class="rounded-lg border bg-card p-6">
					<Rocket class="text-primary mb-4 size-8" />
					<h3 class="mb-2 text-xl font-semibold">Easy Deployments</h3>
					<p class="text-muted-foreground">
						Automated build-pack detection and Docker-based containerization out of the box.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA Section -->
	<section class="container mx-auto px-4 py-20">
		<div class="mx-auto max-w-4xl rounded-lg border bg-card p-12 text-center">
			<h2 class="mb-4 text-3xl font-bold">Ready to Get Started?</h2>
			<p class="text-muted-foreground mb-8 text-lg">
				Join the community and start self-hosting your applications today.
			</p>
			<div class="flex flex-col gap-4 sm:flex-row sm:justify-center">
				<Button size="lg" onclick={() => goto('/docs')}>
					Read the Docs
					<ArrowRight class="ml-2 size-4" />
				</Button>
				<Button size="lg" variant="outline" onclick={() => goto('/register')}>
					Sign Up
				</Button>
			</div>
		</div>
	</section>
</div>
