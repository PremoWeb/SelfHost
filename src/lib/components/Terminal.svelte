<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { api } from '$lib/api/client';
	import { browser } from '$app/environment';

	let terminalContainer: HTMLDivElement;
	let term: any;
	let fitAddon: any;

	interface Props {
		streamId?: string;
		serverName?: string;
		serverIp?: string;
		serverId?: string;
	}

	let { streamId, serverName, serverIp, serverId }: Props = $props();

	let currentLine = '';
	// Use serverId prop if provided, otherwise fall back to page params
	const serverIdToUse = $derived(serverId || $page.params.id);

	onMount(() => {
		if (!browser) return;

		let mounted = true;
		let resizeObserver: ResizeObserver;
		const handleResize = () => fitAddon?.fit();

		const init = async () => {
			// Dynamically import xterm only on client side
			const [{ Terminal }, { FitAddon }] = await Promise.all([
				import('@xterm/xterm'),
				import('@xterm/addon-fit')
			]);

			if (!mounted) return;

			// Import CSS
			await import('@xterm/xterm/css/xterm.css');

			term = new Terminal({
				cursorBlink: true,
				convertEol: true,
				theme: {
					background: '#0F0F0F',
					foreground: '#ffffff',
					cursor: '#ffffff'
				},
				fontFamily: 'Menlo, Monaco, "Courier New", monospace',
				fontSize: 14,
				rows: 24,
				cols: 80
			});

			fitAddon = new FitAddon();
			term.loadAddon(fitAddon);
			term.open(terminalContainer);
			fitAddon.fit();

			if (serverName && serverIp) {
				term.writeln(`\x1b[1;32mConnected to ${serverName} (${serverIp})\x1b[0m`);
			} else {
				term.writeln('\x1b[1;32mWelcome to PremoHost Terminal\x1b[0m');
			}
			term.writeln('Type a command and press Enter...');

			if (streamId) {
				// Log stream mode (read-only)
				term.writeln(`Connecting to stream: ${streamId}...`);
				// ... existing echo logic ...
			} else {
				// Interactive Shell Mode (Pseudo)
				term.write('\r\n$ ');

				term.onData((data: string) => {
					// Handle backspace (ASCII 127 or 8)
					if (data === '\x7f' || data === '\b') {
						if (currentLine.length > 0) {
							term.write('\b \b');
							currentLine = currentLine.slice(0, -1);
						}
						return;
					}

					// Handle enter (ASCII 13)
					if (data === '\r' || data === '\n') {
						term.write('\r\n');
						execute(currentLine);
						currentLine = '';
						return;
					}

					// Handle paste or normal typing
					// Simple implementation: just append and echo
					currentLine += data;
					term.write(data);
				});
			}

			resizeObserver = new ResizeObserver(() => {
				try {
					fitAddon.fit();
				} catch (e) {
					// ignore
				}
			});
			resizeObserver.observe(terminalContainer);

			window.addEventListener('resize', handleResize);
		};

		init();

		return () => {
			mounted = false;
			if (resizeObserver) resizeObserver.disconnect();
			window.removeEventListener('resize', handleResize);
			if (term) term.dispose();
		};
	});

	async function execute(command: string) {
		if (!command.trim()) {
			term.write('$ ');
			return;
		}

		try {
			const response = (await api.post(`/servers/${serverIdToUse}/execute`, { command })) as any;
			const data = response.data;

			if (data.stdout) {
				term.write(data.stdout);
			}
			if (data.stderr) {
				term.writeln(`\x1b[1;31m${data.stderr}\x1b[0m`);
			}
		} catch (error: any) {
			term.writeln(`\x1b[1;31mError: ${error.response?.data?.message || 'Command failed'}\x1b[0m`);
		}

		term.write('$ ');
	}
</script>

<div
	class="h-full min-h-[600px] w-full overflow-hidden rounded-lg bg-[#0F0F0F] pt-2 pl-2"
	bind:this={terminalContainer}
></div>
