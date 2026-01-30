<script lang="ts">
	import DocSidebar from './DocSidebar.svelte';
	import TableOfContents from './TableOfContents.svelte';
	import PublicHeader from '$lib/components/layout/PublicHeader.svelte';
	import PublicFooter from '$lib/components/layout/PublicFooter.svelte';
	import { page } from '$app/state';
	import {
		processMarkdown,
		addIdsToHeadings,
		extractHeadingsFromHtml,
		type Heading
	} from '$lib/utils/markdown';
	import AgentArchitectureDiagram from '$lib/components/docs/AgentArchitectureDiagram.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { fade } from 'svelte/transition';
	import {
		ChevronLeft,
		ChevronRight,
		Home,
		ChevronRight as ChevronRightIcon
	} from '@lucide/svelte';
	import { toastStore } from '$lib/stores/toast';

	type NavItem = { title: string; path: string };
	type NavSection = { section: string; items: NavItem[] };

	const {
		content = '',
		title = '',
		navItems = [],
		showPublicHeader = false
	} = $props<{
		content: string;
		title?: string;
		navItems: NavSection[];
		showPublicHeader?: boolean;
	}>();

	let htmlContent = $state('');
	let headings = $state<Heading[]>([]);
	let isLoading = $state(true);
	let articleElement: HTMLElement | null = $state(null);

	const flattenedNav = $derived(navItems.flatMap((n: NavSection) => n.items));
	const currentIndex = $derived(
		flattenedNav.findIndex(
			(item: NavItem) => item.path === page.url.pathname || item.path === `${page.url.pathname}/`
		)
	);
	const prevItem = $derived(currentIndex > 0 ? flattenedNav[currentIndex - 1] : null);
	const nextItem = $derived(
		currentIndex < flattenedNav.length - 1 ? flattenedNav[currentIndex + 1] : null
	);

	const currentSection = $derived(
		navItems.find((s: NavSection) =>
			s.items.some(
				(i: NavItem) => i.path === page.url.pathname || i.path === `${page.url.pathname}/`
			)
		)?.section || 'Documentation'
	);

	let showAgentDiagram = $state(false);

	$effect(() => {
		if (content) {
			isLoading = true;
			// Check if content contains agent architecture diagram marker
			showAgentDiagram = content.includes('AGENT_ARCH_DIAGRAM') || content.includes('```agent-architecture');
			
			processMarkdown(content).then((html) => {
				// Replace agent diagram placeholder with empty div (component will render separately)
				html = html.replace(/<div class="agent-architecture-diagram-placeholder"><\/div>/g, '');
				
				const htmlWithIds = addIdsToHeadings(html);
				htmlContent = htmlWithIds;
				headings = extractHeadingsFromHtml(htmlWithIds);
				isLoading = false;
				
				// Render Mermaid diagrams after HTML is inserted
				setTimeout(() => {
					if (articleElement) {
						renderMermaidDiagrams(articleElement);
					}
				}, 100);
			});
		}
	});

	async function renderMermaidDiagrams(container: HTMLElement) {
		if (typeof window === 'undefined') return;
		
		const mermaidElements = container.querySelectorAll('.mermaid-diagram');
		if (mermaidElements.length === 0) return;

		const { default: mermaid } = await import('mermaid');
		
		mermaid.initialize({
			startOnLoad: false,
			theme: 'dark',
			themeVariables: {
				primaryColor: '#3b82f6',
				primaryTextColor: '#ffffff',
				primaryBorderColor: '#475569',
				lineColor: '#64748b',
				secondaryColor: '#64748b',
				tertiaryColor: '#8b5cf6',
				fontSize: '16px'
			},
			securityLevel: 'loose',
			flowchart: {
				useMaxWidth: false,
				htmlLabels: false,
				curve: 'basis',
				nodeSpacing: 100,
				rankSpacing: 120,
				padding: 30,
				defaultRenderer: 'dagre-wrapper'
			}
		});

		for (const el of Array.from(mermaidElements)) {
			const code = el.getAttribute('data-mermaid-code');
			if (!code) continue;
			
			const decodedCode = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
			const diagramId = `mermaid-${Math.random().toString(36).substring(7)}`;
			
			try {
				const { svg } = await mermaid.render(diagramId, decodedCode);
				const wrapper = document.createElement('div');
				wrapper.className = 'mermaid-wrapper my-12 relative group';
				wrapper.innerHTML = `
					<div class="mermaid-container rounded-lg border-2 border-border bg-muted/30 p-8 overflow-x-auto">
						${svg}
					</div>
					<button class="mermaid-fullscreen-btn absolute top-4 right-4 p-2 rounded-md bg-background/80 border border-border opacity-0 group-hover:opacity-100 transition-all hover:bg-background hover:border-primary" aria-label="View fullscreen" title="View fullscreen">
						<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
					</button>
				`;
				
				// Add fullscreen functionality
				const fullscreenBtn = wrapper.querySelector('.mermaid-fullscreen-btn');
				const mermaidContainer = wrapper.querySelector('.mermaid-container');
				if (fullscreenBtn && mermaidContainer) {
					fullscreenBtn.addEventListener('click', () => {
						openFullscreen(mermaidContainer as HTMLElement);
					});
				}
				
				el.replaceWith(wrapper);
			} catch (error) {
				console.error('Mermaid rendering error:', error);
				const errorDiv = document.createElement('div');
				errorDiv.className = 'text-destructive p-4 rounded-md bg-destructive/10 my-8';
				errorDiv.textContent = `Error rendering diagram: ${error instanceof Error ? error.message : 'Unknown error'}`;
				el.replaceWith(errorDiv);
			}
		}
	}

	function openFullscreen(element: HTMLElement) {
		if (typeof document === 'undefined') return;
		
		// Create fullscreen overlay
		const overlay = document.createElement('div');
		overlay.className = 'fixed inset-0 z-[9999] bg-background p-8 overflow-auto';
		overlay.innerHTML = `
			<div class="relative w-full h-full flex items-center justify-center">
				<button class="absolute top-4 right-4 p-3 rounded-md bg-background border-2 border-border hover:border-primary transition-all z-10" aria-label="Close fullscreen">
					<svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
				</button>
				<div class="mermaid-fullscreen-content w-full max-w-7xl"></div>
			</div>
		`;
		
		const content = overlay.querySelector('.mermaid-fullscreen-content');
		if (content) {
			// Clone and scale up the SVG
			const svg = element.querySelector('svg');
			if (svg) {
				const clonedSvg = svg.cloneNode(true) as SVGElement;
				clonedSvg.style.width = '100%';
				clonedSvg.style.height = 'auto';
				clonedSvg.style.maxWidth = '100%';
				content.appendChild(clonedSvg);
			}
		}
		
		const closeBtn = overlay.querySelector('button');
		closeBtn?.addEventListener('click', () => {
			document.body.removeChild(overlay);
		});
		
		overlay.addEventListener('click', (e) => {
			if (e.target === overlay) {
				document.body.removeChild(overlay);
			}
		});
		
		document.body.appendChild(overlay);
	}

	// Handle Copy to Clipboard
	function handleCopy(e: MouseEvent) {
		const target = e.target as HTMLElement;
		const copyButton = target.closest('[data-copy-target]') as HTMLButtonElement;
		if (!copyButton) return;
		
		const codeWrapper = copyButton.closest('.code-wrapper');
		if (!codeWrapper) return;
		
		// Get code content from pre or code element
		const pre = codeWrapper.querySelector('pre');
		const code = codeWrapper.querySelector('code');
		const codeElement = pre || code;
		
		if (codeElement) {
			const text = codeElement.innerText || codeElement.textContent || '';
			
			navigator.clipboard.writeText(text).then(() => {
				toastStore.success('Copied to clipboard');
				
				// Visual feedback
				const copyText = copyButton.querySelector('.copy-text');
				const originalText = copyText?.textContent || 'Copy';
				const originalHTML = copyButton.innerHTML;
				
				if (copyText) {
					copyText.textContent = 'Copied!';
					copyButton.classList.add('copied');
				}
				
				setTimeout(() => {
					if (copyText) {
						copyText.textContent = originalText;
					}
					copyButton.classList.remove('copied');
				}, 2000);
			}).catch(() => {
				toastStore.error('Failed to copy');
			});
		}
	}
	
	// Initialize copy buttons after content loads
	$effect(() => {
		if (articleElement && !isLoading) {
			setTimeout(() => {
				if (!articleElement) return;
				const copyButtons = articleElement.querySelectorAll('[data-copy-target]');
				copyButtons.forEach(btn => {
					btn.addEventListener('click', (e: Event) => {
						handleCopy(e as MouseEvent);
					});
				});
			}, 100);
		}
	});
</script>

{#if showPublicHeader}
	<PublicHeader />
{/if}

<div class="container mx-auto px-4">
	<!-- Sticky Breadcrumbs -->
	<div
		class="border-border/40 bg-background/80 sticky z-20 -mx-4 mb-8 border-b px-4 py-4 backdrop-blur-md {showPublicHeader ? 'top-16' : 'top-0 lg:top-0'}"
	>
		<nav class="text-muted-foreground/60 flex items-center gap-2 text-xs">
			<a href="/" class="hover:text-primary flex items-center gap-1 transition-colors">
				<Home class="size-3" />
				<span>Dashboard</span>
			</a>
			<ChevronRightIcon class="size-3" />
			<a href="/docs" class="hover:text-primary transition-colors">Documentation</a>
			<ChevronRightIcon class="size-3" />
			<span class="text-muted-foreground font-medium">{currentSection}</span>
			<ChevronRightIcon class="size-3" />
			<span class="text-primary font-bold">{title}</span>
		</nav>
	</div>

	<div class="grid grid-cols-1 gap-12 lg:grid-cols-12">
		<!-- Sidebar -->
		<aside class="lg:col-span-3">
			<div class="sticky {showPublicHeader ? 'top-24' : 'top-24'}">
				<DocSidebar {navItems} />
			</div>
		</aside>

		<!-- Main Content -->
		<main class="space-y-12 lg:col-span-6">
			<div class="space-y-8">
				<div class="space-y-4">
					<h1 class="text-foreground text-4xl font-extrabold tracking-tighter sm:text-5xl">
						{title}
					</h1>
					<div class="bg-primary h-1 w-20 rounded-full"></div>
				</div>
				<div class="text-muted-foreground/60 flex items-center gap-4 text-xs font-medium">
					<span class="flex items-center gap-1.5">
						<div class="size-1.5 rounded-full bg-green-500"></div>
						Verified Documentation
					</span>
					<span class="bg-border/50 h-3 w-px"></span>
					<span>Last updated: {new Date().toLocaleDateString()}</span>
				</div>
			</div>

			<Card.Root class="border-none bg-transparent shadow-none">
				<Card.Content class="p-0">
					{#if isLoading}
						<div class="flex items-center justify-center py-20" in:fade>
							<div class="border-primary size-8 animate-spin rounded-full border-b-2"></div>
						</div>
					{:else}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
						<article
							bind:this={articleElement}
							class="prose-headings:text-foreground prose-h2:border-border/60 prose-p:text-muted-foreground/90
                            prose-strong:text-foreground prose-a:text-primary prose-code:bg-muted/50
                            prose-code:text-foreground prose-li:text-muted-foreground/90 prose-ol:text-muted-foreground/90 prose-blockquote:border-primary/30 prose-blockquote:bg-muted/30 prose-blockquote:text-muted-foreground prose-th:bg-muted/50
                            prose-td:border-border/40 prose max-w-none dark:prose-invert
                            prose-headings:font-bold prose-headings:tracking-tight prose-h2:mt-24
                            prose-h2:mb-10 prose-h2:border-b
                            prose-h2:pb-4 prose-h2:text-3xl prose-h2:tracking-tighter prose-h3:mt-16 prose-h3:mb-6
                            prose-h3:text-2xl prose-h3:tracking-tight prose-p:my-8 prose-p:leading-8 prose-a:font-semibold prose-a:no-underline prose-a:underline-offset-4 hover:prose-a:underline
                            prose-blockquote:my-10 prose-blockquote:rounded-r-lg
                            prose-blockquote:border-l-4 prose-blockquote:py-4 prose-blockquote:pr-8 prose-blockquote:pl-8 prose-blockquote:italic
                            prose-strong:font-bold prose-code:rounded-md prose-code:px-1.5 prose-code:py-0.5
                            prose-code:font-mono prose-code:text-sm prose-code:font-medium
                            prose-code:before:content-none prose-code:after:content-none prose-pre:m-0! prose-pre:border-none! prose-pre:bg-transparent! prose-pre:p-0! prose-pre:shadow-none! prose-ol:my-8 prose-ol:list-decimal prose-ul:my-8
                            prose-ul:list-disc prose-li:my-4 prose-table:my-12 prose-table:border-collapse prose-th:p-4 prose-th:text-xs prose-th:font-bold prose-th:tracking-widest prose-th:uppercase prose-td:border-b prose-td:p-4 prose-td:text-sm"
							in:fade
						>
							{@html htmlContent}
						</article>
						
						{#if showAgentDiagram}
							<AgentArchitectureDiagram />
						{/if}
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Navigation Footer -->
			<div class="border-border/50 mt-24 border-t pt-12">
				<div class="flex items-center justify-between">
					<div>
						{#if prevItem}
							<Button
								href={prevItem.path}
								variant="outline"
								class="group border-border/40 hover:border-primary/50 flex h-auto flex-col items-start gap-2 px-8 py-5 shadow-sm transition-all"
							>
								<span
									class="text-muted-foreground group-hover:text-primary flex items-center text-[10px] font-bold tracking-[0.2em] uppercase transition-colors"
								>
									<ChevronLeft class="mr-2 size-3" />
									Previous
								</span>
								<span class="text-lg font-bold tracking-tight">{prevItem.title}</span>
							</Button>
						{/if}
					</div>
					<div class="text-right">
						{#if nextItem}
							<Button
								href={nextItem.path}
								variant="outline"
								class="group border-border/40 hover:border-primary/50 flex h-auto flex-col items-end gap-2 px-8 py-5 shadow-sm transition-all"
							>
								<span
									class="text-muted-foreground group-hover:text-primary flex items-center text-[10px] font-bold tracking-[0.2em] uppercase transition-colors"
								>
									Next
									<ChevronRight class="ml-2 size-3" />
								</span>
								<span class="text-lg font-bold tracking-tight">{nextItem.title}</span>
							</Button>
						{/if}
					</div>
				</div>
			</div>
		</main>

		<!-- TOC -->
		<aside class="hidden xl:col-span-3 xl:block">
			<div class="sticky {showPublicHeader ? 'top-24' : 'top-24'}">
				<TableOfContents {headings} />
			</div>
		</aside>
	</div>
</div>

{#if showPublicHeader}
	<PublicFooter />
{/if}

<style>
	/* Code Block & Shiki Enhancements */
	:global(.code-wrapper) {
		position: relative;
		margin: 2.5rem 0 !important;
		border-radius: 0.75rem;
		overflow: hidden;
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		box-shadow: 
			0 1px 3px 0 rgba(0, 0, 0, 0.1),
			0 4px 12px 0 rgba(0, 0, 0, 0.08);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	:global(.dark .code-wrapper) {
		background: hsl(var(--card));
		border-color: hsl(var(--border));
		box-shadow: 
			0 1px 3px 0 rgba(0, 0, 0, 0.4),
			0 4px 12px 0 rgba(0, 0, 0, 0.5),
			0 0 0 1px rgba(255, 255, 255, 0.05);
	}

	:global(.code-wrapper:hover) {
		border-color: hsl(var(--primary) / 0.4);
		box-shadow: 
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 10px 28px -2px rgba(0, 0, 0, 0.15),
			0 0 0 1px hsl(var(--primary) / 0.2);
		transform: translateY(-1px);
	}

	:global(.dark .code-wrapper:hover) {
		border-color: hsl(var(--primary) / 0.5);
		box-shadow: 
			0 4px 6px -1px rgba(0, 0, 0, 0.5),
			0 10px 28px -2px rgba(0, 0, 0, 0.6),
			0 0 0 1px hsl(var(--primary) / 0.3);
	}

	/* Code Header */
	:global(.code-wrapper .code-header) {
		background: hsl(var(--muted) / 0.4);
		border-bottom: 1px solid hsl(var(--border) / 0.5);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}

	:global(.dark .code-wrapper .code-header) {
		background: hsl(var(--muted) / 0.25);
		border-bottom-color: hsl(var(--border) / 0.5);
	}

	:global(.code-wrapper .language-label) {
		color: hsl(var(--muted-foreground));
		font-weight: 600;
		letter-spacing: 0.05em;
		font-size: 0.6875rem;
		text-transform: uppercase;
	}

	/* Code Content */
	:global(.code-wrapper .code-content) {
		position: relative;
		overflow-x: auto;
		overflow-y: hidden;
		background: hsl(var(--muted) / 0.2);
	}

	:global(.dark .code-wrapper .code-content) {
		background: hsl(var(--muted) / 0.1);
	}

	:global(.code-wrapper .code-content.with-line-numbers) {
		padding-left: 0;
	}

	:global(.shiki) {
		padding: 1.5rem 1.25rem !important;
		border-radius: 0 !important;
		border: none !important;
		overflow-x: auto;
		overflow-y: hidden;
		font-family:
			'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, 
			Consolas, 'Liberation Mono', 'Courier New', monospace !important;
		font-size: 0.875rem !important;
		line-height: 1.75 !important;
		letter-spacing: 0.01em;
		margin: 0 !important;
		box-shadow: none !important;
		background-color: transparent !important;
		tab-size: 2;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}

	:global(.dark .shiki) {
		background-color: transparent !important;
	}

	:global(.shiki code) {
		background-color: transparent !important;
		padding: 0 !important;
		border-radius: 0 !important;
		color: inherit !important;
		font-family: inherit !important;
		font-size: inherit !important;
		line-height: inherit !important;
	}

	/* Line Numbers */
	:global(.code-wrapper .code-content.with-line-numbers) {
		counter-reset: line-number;
	}

	:global(.code-wrapper .code-content.with-line-numbers::before) {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3.5rem;
		background: hsl(var(--muted) / 0.2);
		border-right: 1px solid hsl(var(--border) / 0.4);
		pointer-events: none;
		z-index: 1;
	}

	:global(.dark .code-wrapper .code-content.with-line-numbers::before) {
		background: hsl(var(--muted) / 0.15);
		border-right-color: hsl(var(--border) / 0.3);
	}

	:global(.code-wrapper .code-content.with-line-numbers pre) {
		padding-left: 4rem !important;
		position: relative;
	}

	:global(.shiki .line) {
		position: relative;
		display: block;
		min-height: 1.75em;
		padding-left: 0.5rem;
		padding-right: 0.5rem;
	}

	:global(.shiki .line:hover) {
		background: hsl(var(--muted) / 0.3);
	}

	:global(.dark .shiki .line:hover) {
		background: hsl(var(--muted) / 0.2);
	}

	:global(.code-wrapper .code-content.with-line-numbers .shiki .line::before) {
		content: counter(line-number);
		counter-increment: line-number;
		position: absolute;
		left: -3.5rem;
		width: 3rem;
		text-align: right;
		padding-right: 0.75rem;
		color: hsl(var(--muted-foreground) / 0.5);
		font-size: 0.75rem;
		font-weight: 500;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		user-select: none;
		pointer-events: none;
		line-height: 1.75;
		opacity: 0.7;
	}

	/* Copy button enhancement */
	:global(.code-wrapper .copy-button) {
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		font-size: 0.75rem;
	}

	:global(.code-wrapper .copy-button:hover) {
		transform: translateY(-1px);
		background: hsl(var(--accent)) !important;
		border-color: hsl(var(--accent-foreground) / 0.2) !important;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	:global(.dark .code-wrapper .copy-button:hover) {
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	:global(.code-wrapper .copy-button:active) {
		transform: translateY(0);
	}

	:global(.code-wrapper .copy-button.copied) {
		background: hsl(var(--primary) / 0.15) !important;
		border-color: hsl(var(--primary) / 0.4) !important;
	}

	:global(.code-wrapper .copy-button.copied .copy-text) {
		color: hsl(var(--primary));
		font-weight: 600;
	}

	/* Syntax highlighting improvements */
	:global(.shiki .token.comment) {
		opacity: 0.7;
		font-style: italic;
	}

	:global(.shiki .token.string) {
		opacity: 0.95;
	}

	/* Better text selection */
	:global(.code-wrapper .code-content ::selection) {
		background: hsl(var(--primary) / 0.2);
		color: inherit;
	}

	:global(.code-wrapper .code-content ::-moz-selection) {
		background: hsl(var(--primary) / 0.2);
		color: inherit;
	}

	/* Focus states for accessibility */
	:global(.code-wrapper .copy-button:focus-visible) {
		outline: 2px solid hsl(var(--primary));
		outline-offset: 2px;
	}

	/* Improve code readability */
	:global(.shiki .line:empty) {
		min-height: 1.75em;
	}

	/* Better spacing for code blocks */
	:global(.code-wrapper + .code-wrapper) {
		margin-top: 2rem;
	}

	/* Scrollbar styling for code blocks */
	:global(.code-wrapper .code-content::-webkit-scrollbar) {
		height: 8px;
	}

	:global(.code-wrapper .code-content::-webkit-scrollbar-track) {
		background: hsl(var(--muted) / 0.3);
		border-radius: 4px;
	}

	:global(.code-wrapper .code-content::-webkit-scrollbar-thumb) {
		background: hsl(var(--muted-foreground) / 0.3);
		border-radius: 4px;
	}

	:global(.code-wrapper .code-content::-webkit-scrollbar-thumb:hover) {
		background: hsl(var(--muted-foreground) / 0.5);
	}

	/* Admonition Icons */
	:global(.admonition-icon-info::before) {
		content: 'ⓘ';
	}
	:global(.admonition-icon-lightbulb::before) {
		content: '💡';
	}
	:global(.admonition-icon-alert-triangle::before) {
		content: '⚠️';
	}
	:global(.admonition-icon-zap::before) {
		content: '⚡';
	}
	:global(.admonition-icon-alert-circle::before) {
		content: '⛔';
	}

	:global(.admonition p) {
		margin: 0.75rem 0 !important;
	}

	/* Mermaid diagram styling */
	:global(.mermaid-wrapper) {
		position: relative;
		margin: 3rem 0 !important;
	}

	:global(.mermaid-container) {
		min-height: 400px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	:global(.mermaid-wrapper svg) {
		width: 100%;
		min-width: 900px;
		height: auto;
		font-size: 18px !important;
	}

	:global(.mermaid-wrapper .nodeLabel) {
		font-size: 16px !important;
		font-weight: 600;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	:global(.mermaid-wrapper .node rect),
	:global(.mermaid-wrapper .node circle),
	:global(.mermaid-wrapper .node ellipse) {
		rx: 8px;
		ry: 8px;
		min-width: 120px;
		min-height: 50px;
	}

	:global(.mermaid-wrapper .edgeLabel) {
		font-size: 14px !important;
		background: transparent !important;
	}

	:global(.mermaid-wrapper .edgePath .path) {
		stroke-width: 3px;
	}

	:global(.mermaid-wrapper .cluster rect) {
		rx: 12px;
		ry: 12px;
	}

	:global(.mermaid-fullscreen-content svg) {
		width: 100% !important;
		height: auto !important;
		min-width: auto !important;
		font-size: 20px !important;
	}

	:global(.mermaid-fullscreen-content .node rect),
	:global(.mermaid-fullscreen-content .node circle),
	:global(.mermaid-fullscreen-content .node ellipse) {
		font-size: 18px !important;
	}

	:global(.mermaid-fullscreen-content .edgeLabel) {
		font-size: 16px !important;
	}

	/* Table of Contents responsiveness */
	@media (max-width: 1280px) {
		:global(.container) {
			max-width: 100% !important;
		}
	}
</style>
