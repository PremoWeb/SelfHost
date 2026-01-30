<script lang="ts">
	import {
		CheckCircle2,
		Circle,
		ArrowRight,
		ShieldCheck,
		Server,
		Code2,
		Layers
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { cn } from '$lib/utils';
	import { pushState } from '$app/navigation';

	interface Props {
		stats: {
			keys: number;
			servers: number;
			sources: number;
			projects: number;
		};
	}

	let { stats }: Props = $props();

	const steps = $derived([
		{
			id: 'ssh-key',
			title: 'Add an SSH Key',
			description: 'Add your private key to securely connect to your servers.',
			href: '/security/private-key',
			completed: stats.keys > 0,
			icon: ShieldCheck,
			shallow: true
		},
		{
			id: 'server',
			title: 'Add a Server',
			description: 'Connect your first server or cloud provider instance.',
			href: '/servers',
			completed: stats.servers > 0,
			icon: Server,
			shallow: true
		},
		{
			id: 'source',
			title: 'Connect Git Source',
			description: 'Connect GitHub, GitLab, or a custom Git repository.',
			href: '/sources',
			completed: stats.sources > 0,
			icon: Code2,
			shallow: false
		},
		{
			id: 'project',
			title: 'Create First Project',
			description: 'Organize your applications and databases into a project.',
			href: '/projects',
			completed: stats.projects > 0,
			icon: Layers,
			shallow: false
		}
	]);

	const completedCount = $derived(steps.filter((s) => s.completed).length);
	const progressPercent = $derived((completedCount / steps.length) * 100);

	function handleStartStep(e: MouseEvent, step: (typeof steps)[0]) {
		if (step.shallow) {
			e.preventDefault();
			pushState(step.href, { onboardingStep: step.id as any });
		}
	}
</script>

{#if completedCount < steps.length}
	<Card.Root
		class="border-primary/20 from-primary/5 via-background to-background mb-8 overflow-hidden bg-linear-to-br"
	>
		<Card.Header class="pb-4">
			<div class="flex items-center justify-between">
				<div>
					<Card.Title class="text-xl">Get Started with SelfHost</Card.Title>
					<Card.Description
						>Follow these steps to get your first deployment up and running.</Card.Description
					>
				</div>
				<div class="text-right">
					<span class="text-primary text-2xl font-bold">{completedCount}/{steps.length}</span>
					<p class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
						Steps Completed
					</p>
				</div>
			</div>
			<div class="bg-secondary mt-4 h-2 w-full overflow-hidden rounded-full">
				<div
					class="bg-primary h-full transition-all duration-500 ease-out"
					style="width: {progressPercent}%"
				></div>
			</div>
		</Card.Header>
		<Card.Content>
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{#each steps as step}
					<div
						class={cn(
							'relative flex flex-col justify-between rounded-xl border p-4 transition-all',
							step.completed
								? 'border-primary/20 bg-primary/5 opacity-80'
								: 'border-border bg-card hover:border-primary/40 hover:shadow-md'
						)}
					>
						<div>
							<div class="mb-3 flex items-center justify-between">
								<div
									class={cn(
										'rounded-lg p-2',
										step.completed
											? 'bg-primary/20 text-primary'
											: 'bg-secondary text-muted-foreground'
									)}
								>
									<step.icon class="size-5" />
								</div>
								{#if step.completed}
									<CheckCircle2 class="text-primary size-5" />
								{:else}
									<Circle class="text-muted-foreground/30 size-5" />
								{/if}
							</div>
							<h3 class="font-semibold">{step.title}</h3>
							<p class="text-muted-foreground mt-1 line-clamp-2 text-xs">
								{step.description}
							</p>
						</div>

						<div class="mt-4">
							{#if step.completed}
								<div class="text-primary flex items-center text-xs font-medium">
									<CheckCircle2 class="mr-1.5 size-3" />
									Completed
								</div>
							{:else}
								<Button
									variant="outline"
									size="sm"
									href={step.href}
									onclick={(e) => handleStartStep(e, step)}
									class="w-full text-xs"
								>
									Start Step
									<ArrowRight class="ml-2 size-3" />
								</Button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</Card.Content>
	</Card.Root>
{/if}
