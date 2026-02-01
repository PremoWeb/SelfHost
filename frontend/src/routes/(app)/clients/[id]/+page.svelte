<script lang="ts">
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
    import Separator from "$lib/components/ui/separator/separator.svelte";
	import { Label } from '$lib/components/ui/label';
	import { Folder, Building2, Mail, Phone, ArrowLeft, ExternalLink, Activity, User } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/helpers';
    import PageTitle from '$lib/components/PageTitle.svelte';

	let { data }: { data: PageData } = $props();
	const client = $derived(data.client);
</script>

<PageTitle title={client.name} />

<div class="space-y-6">
	<!-- Header -->
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="flex items-center gap-4">
             <Button variant="outline" size="icon" href="/clients" class="shrink-0">
                <ArrowLeft class="size-4" />
            </Button>
            <div>
                <div class="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <a href="/clients" class="hover:text-foreground transition-colors">Clients</a>
                    <span>/</span>
                    <span class="text-foreground">{client.name}</span>
                </div>
                <h1 class="text-3xl font-bold tracking-tight text-foreground">{client.name}</h1>
            </div>
        </div>
    </div>

	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Client Details Sidebar -->
		<Card.Root class="md:col-span-1 h-fit">
			<Card.Header>
                <div class="flex items-center gap-2">
                    <div class="p-2 bg-primary/10 rounded-full">
                        <User class="size-5 text-primary" />
                    </div>
				    <Card.Title class="text-lg">Contact Details</Card.Title>
                </div>
			</Card.Header>
			<Card.Content class="space-y-6">
				<div class="grid gap-1">
					<Label class="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Company</Label>
					<div class="flex items-center gap-2 font-medium">
						<Building2 class="size-4 text-muted-foreground" />
						{client.company || '—'}
					</div>
				</div>
                <Separator />
				<div class="grid gap-1">
					<Label class="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Email</Label>
					<div class="flex items-center gap-2 font-medium">
						<Mail class="size-4 text-muted-foreground" />
						{client.email || '—'}
					</div>
				</div>
                <Separator />
				<div class="grid gap-1">
					<Label class="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Phone</Label>
					<div class="flex items-center gap-2 font-medium">
						<Phone class="size-4 text-muted-foreground" />
						{client.phone || '—'}
					</div>
				</div>
				<div class="pt-2">
                    <div class="bg-muted/50 rounded-lg p-3 text-center">
                        <div class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Customer Since</div>
                        <div class="font-bold text-foreground">
                            {formatDate(client.createdAt.toString())}
                        </div>
                    </div>
				</div>
			</Card.Content>
		</Card.Root>

        <!-- Projects Grid -->
		<div class="md:col-span-2 space-y-6">
			<div class="flex items-center justify-between pb-2 border-b">
				<h2 class="text-xl font-semibold flex items-center gap-2">
					<Folder class="size-5 text-muted-foreground" />
					Assigned Projects 
                    <Badge variant="secondary" class="ml-1 text-xs">{client.projects.length}</Badge>
				</h2>
			</div>

			<div class="grid gap-4">
				{#each client.projects as project}
					<Card.Root class="hover:border-primary/50 transition-colors">
						<Card.Header>
                            <div class="flex items-start justify-between">
                                <div class="space-y-1">
                                    <Card.Title class="text-lg font-bold">
                                        <a href="/projects/{project.id}" class="hover:underline flex items-center gap-2">
                                            {project.name}
                                            <ExternalLink class="size-3 text-muted-foreground" />
                                        </a>
                                    </Card.Title>
                                    {#if project.description}
                                        <Card.Description>{project.description}</Card.Description>
                                    {/if}
                                </div>
                                <Badge variant="outline" class="flex items-center gap-1.5 font-normal">
                                    <Activity class="size-3" />
                                    {project.environments.length} Envs
                                </Badge>
                            </div>
						</Card.Header>
						<Card.Content>
                            {#if project.environments.length > 0}
							    <div class="flex flex-wrap gap-2 mt-2">
                                    {#each project.environments as env}
                                        <div class="flex items-center gap-2 text-xs border rounded-full px-2.5 py-1 bg-background text-muted-foreground">
                                            <div class="size-1.5 rounded-full bg-green-500"></div>
                                            {env.name}
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                <span class="text-sm text-muted-foreground italic">No environments configured</span>
                            {/if}
						</Card.Content>
					</Card.Root>
				{:else}
					<div class="py-16 flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-muted/5 text-center">
						<div class="p-3 bg-muted rounded-full mb-4">
                            <Folder class="size-6 text-muted-foreground" />
                        </div>
						<h3 class="text-lg font-semibold mb-1">No Projects</h3>
						<p class="text-muted-foreground text-sm max-w-sm mb-6">
                            This client does not have any projects assigned yet.
                        </p>
						<Button variant="outline" href="/projects">
							Assign Project
						</Button>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
