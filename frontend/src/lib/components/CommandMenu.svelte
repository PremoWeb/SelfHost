<script lang="ts">
	import * as Command from '$lib/components/ui/command';
	import {
		Calculator,
		Calendar,
		CreditCard,
		Settings,
		Smile,
		User,
		Search,
		Server,
		Globe,
		Database,
		Code
	} from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';

	export let open = false;

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			open = !open;
		}
	}

	function runCommand(command: () => void) {
		open = false;
		command();
	}

	if (typeof document !== 'undefined') {
		document.addEventListener('keydown', handleKeydown);
	}

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.removeEventListener('keydown', handleKeydown);
		}
	});
</script>

<Command.Dialog bind:open>
	<Command.Input placeholder="Type a command or search..." />
	<Command.List>
		<Command.Empty>No results found.</Command.Empty>
		<Command.Group heading="Navigation">
			<Command.Item onSelect={() => runCommand(() => goto('/'))}>
				<Globe class="mr-2 h-4 w-4" />
				<span>Dashboard</span>
			</Command.Item>
			<Command.Item onSelect={() => runCommand(() => goto('/servers'))}>
				<Server class="mr-2 h-4 w-4" />
				<span>Servers</span>
			</Command.Item>
			<Command.Item onSelect={() => runCommand(() => goto('/projects'))}>
				<Code class="mr-2 h-4 w-4" />
				<span>Projects</span>
			</Command.Item>
			<Command.Item onSelect={() => runCommand(() => goto('/sources'))}>
				<Database class="mr-2 h-4 w-4" />
				<span>Sources</span>
			</Command.Item>
		</Command.Group>
		<Command.Group heading="Settings">
			<Command.Item onSelect={() => runCommand(() => goto('/settings'))}>
				<Settings class="mr-2 h-4 w-4" />
				<span>Settings</span>
			</Command.Item>
			<Command.Item onSelect={() => runCommand(() => goto('/security/private-key'))}>
				<User class="mr-2 h-4 w-4" />
				<span>Private Keys</span>
			</Command.Item>
		</Command.Group>
	</Command.List>
</Command.Dialog>
