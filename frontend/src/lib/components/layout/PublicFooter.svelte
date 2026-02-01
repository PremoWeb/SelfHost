<script lang="ts">
	import { goto } from '$app/navigation';
	import { Github, Twitter, Mail } from 'lucide-svelte';
</script>

<footer class="border-border bg-muted/30 mt-24 border-t">
	<div class="container mx-auto px-4 py-12">
		<div class="grid grid-cols-1 gap-8 md:grid-cols-4">
			<!-- Brand -->
			<div class="space-y-4">
				<div class="flex flex-col">
					<div class="text-lg font-bold">SelfHost.gg</div>
					<div class="text-muted-foreground mt-1 text-xs">
						by <a
							href="https://premoweb.com?utm_source=selfhost&utm_medium=footer&utm_campaign=selfhost"
							target="_blank"
							rel="noopener noreferrer"
							class="text-primary/80 hover:underline">PremoWeb LLC</a
						>
					</div>
				</div>
				<p class="text-muted-foreground text-sm">
					Self-hosting for the greater good. Take control of your infrastructure.
				</p>
			</div>

			<!-- Documentation -->
			<div class="space-y-4">
				<h3 class="font-semibold">Documentation</h3>
				<ul class="text-muted-foreground space-y-2 text-sm">
					<li>
						<a href="/docs/introduction" class="hover:text-foreground transition-colors">
							Getting Started
						</a>
					</li>
					<li>
						<a href="/docs/installation" class="hover:text-foreground transition-colors">
							Installation
						</a>
					</li>
					<li>
						<a href="/docs/projects" class="hover:text-foreground transition-colors">
							Projects
						</a>
					</li>
					<li>
						<a href="/docs/servers" class="hover:text-foreground transition-colors">
							Servers
						</a>
					</li>
				</ul>
			</div>

			<!-- Resources -->
			<div class="space-y-4">
				<h3 class="font-semibold">Resources</h3>
				<ul class="text-muted-foreground space-y-2 text-sm">
					<li>
						<a href="/docs" class="hover:text-foreground transition-colors">
							Documentation
						</a>
					</li>
					<li>
						<a href="/docs/faqs" class="hover:text-foreground transition-colors">
							FAQs
						</a>
					</li>
					<li>
						<a href="/sponsors" class="hover:text-foreground transition-colors">
							Sponsors
						</a>
					</li>
				</ul>
			</div>

			<!-- Connect -->
			<div class="space-y-4">
				<h3 class="font-semibold">Connect</h3>
				<div class="flex items-center gap-4">
					<a
						href="https://github.com/premoweb/selfhost"
						target="_blank"
						rel="noopener noreferrer"
						class="text-muted-foreground hover:text-foreground transition-colors"
						aria-label="GitHub"
					>
						<Github class="size-5" />
					</a>
					<a
						href="https://x.com/maietta"
						target="_blank"
						rel="noopener noreferrer"
						class="text-muted-foreground hover:text-foreground transition-colors"
						aria-label="X (Twitter)"
					>
						<Twitter class="size-5" />
					</a>
					<a
						href="mailto:support@selfhost.gg"
						class="text-muted-foreground hover:text-foreground transition-colors"
						aria-label="Email"
					>
						<Mail class="size-5" />
					</a>
				</div>
			</div>
		</div>

		<!-- Copyright -->
		<div class="border-border mt-8 border-t pt-8">
			<p class="text-muted-foreground text-center text-sm">
				© {new Date().getFullYear()} SelfHost.gg. All rights reserved.
			</p>
		</div>
	</div>
</footer>
