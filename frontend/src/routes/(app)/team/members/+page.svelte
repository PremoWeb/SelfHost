<script lang="ts">
	import { formatDate } from '$lib/utils/helpers';
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { UserPlus, UserMinus, Shield } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();
	let members = $derived(data.members);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b pb-6">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-bold tracking-tight">Team Members</h1>
			<p class="text-muted-foreground">Control access and roles for your team colleagues.</p>
		</div>
		<Button size="sm">
			<UserPlus class="mr-2 size-4" />
			Invite Member
		</Button>
	</div>

	<nav class="flex gap-4 border-b">
		<a
			href="/team"
			class="text-muted-foreground hover:text-foreground px-4 py-2 text-sm font-medium">General</a
		>
		<a href="/team/members" class="border-primary border-b-2 px-4 py-2 text-sm font-medium"
			>Members</a
		>
	</nav>

	<Card.Root>
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Member</Table.Head>
					<Table.Head>Role</Table.Head>
					<Table.Head>Joined</Table.Head>
					<Table.Head class="text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each members as member}
					<Table.Row>
						<Table.Cell>
							<div class="flex flex-col">
								<span class="font-medium">{member.name}</span>
								<span class="text-muted-foreground text-xs">{member.email}</span>
							</div>
						</Table.Cell>
						<Table.Cell>
							<Badge variant="secondary" class="capitalize">{member.role}</Badge>
						</Table.Cell>
						<Table.Cell class="text-muted-foreground text-sm">
							{formatDate(member.joinedAt.toString())}
						</Table.Cell>
						<Table.Cell class="text-right">
							<Button variant="ghost" size="sm" class="text-destructive hover:text-destructive">
								Revoke
							</Button>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Root>
</div>
