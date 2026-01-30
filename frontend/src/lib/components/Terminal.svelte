<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { api } from '$lib/api/client';
	import { browser } from '$app/environment';
	import '@xterm/xterm/css/xterm.css';

	let terminalContainer: HTMLDivElement;
	let term: any;
	let fitAddon: any;

	interface Props {
		streamId?: string;
		serverName?: string;
		serverIp?: string;
		serverId?: string;
		onClose?: () => void;
	}

	let { streamId, serverName, serverIp, serverId, onClose }: Props = $props();

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

			term = new Terminal({
				cursorBlink: true,
				cursorStyle: 'block',
				cursorInactiveStyle: 'outline',
				convertEol: true,
				theme: {
					background: '#0F0F0F',
					foreground: '#ffffff',
					cursor: '#ffffff',
					cursorAccent: '#0F0F0F'
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
			term.focus();

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
					// Handle Ctrl+C (ASCII 3)
					if (data === '\x03') {
						if (activeAbortController) {
							activeAbortController.abort();
							term.write('^C\r\n');
						} else {
							term.write('^C\r\n$ ');
						}
						currentLine = '';
						return;
					}

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

	let activeAbortController: AbortController | null = null;

	async function execute(command: string) {
		const trimmed = command.trim();
		if (!trimmed) {
			term.write('$ ');
			return;
		}

		if (trimmed === 'exit') {
			onClose?.();
			return;
		}

		if (trimmed === 'clear') {
			term.clear();
			term.write('$ ');
			return;
		}

		activeAbortController = new AbortController();

		try {
			const response = await fetch(`/api/servers/${serverIdToUse}/execute?stream=true`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ command }),
				signal: activeAbortController.signal
			});

			if (!response.body) {
				term.writeln(`\x1b[1;31mError: No response from server\x1b[0m`);
				term.write('$ ');
				return;
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				term.write(decoder.decode(value));
			}
		} catch (error: any) {
			if (error.name === 'AbortError') {
				// Don't show redundant error for manual abort handled in onData
			} else {
				term.writeln(`\x1b[1;31mError: ${error.message || 'Command failed'}\x1b[0m`);
			}
		} finally {
			activeAbortController = null;
			currentLine = '';
		}

		term.write('$ ');
		term.focus();
	}
</script>

<div
	class="h-full min-h-[600px] w-full overflow-hidden rounded-lg bg-[#0F0F0F] pt-2 pl-2"
	bind:this={terminalContainer}
></div>
