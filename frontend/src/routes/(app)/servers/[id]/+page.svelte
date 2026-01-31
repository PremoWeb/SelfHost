<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import { dev } from '$app/environment';
	import { serversApi } from '$lib/api/resources/servers';
	import {
		diagnoseServer,
		rebootServer,
		restartAgent,
		forceUpdateService,
		getAppStatus,
		proxyAction,
		checkReadiness,
		installPrivateKeyRemote,
		updateVpsApiKeyRemote
	} from './server.remote';
	import {
		getServerStatus,
		installAgentRemote,
		forceUpdateServiceRemote,
		deployAppRemote,
		deleteAppRemote,
		getAppDiagnosticsRemote,
		createTunnelRemote
	} from '../../servers.remote';
	import { toastStore } from '$lib/stores/toast';
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';

	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/ui/table';
	import {
		Settings,
		Terminal as TerminalIcon,
		ShieldAlert,
		Map,
		Globe,
		Shield,
		Zap,
		RefreshCcw,
		Save,
		Trash2,
		Cloud,
		ChevronRight,
		Tag,
		X,
		ShieldCheck,
		Network,
		Play,
		Square,
		Loader2,
		CircleAlert,
		CircleCheck,
		CheckCircle2,
		AlertCircle,
		RefreshCw,
		ExternalLink,
		Activity,
		RotateCcw,
		Box,
		ChevronDown,
		Server as ServerIcon,
		MapPin,
		Plus,
		Key,
		Copy
	} from '@lucide/svelte';
	import Terminal from '$lib/components/Terminal.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import AddKeyForm from '$lib/components/security/AddKeyForm.svelte';
	import StickyHeader from '$lib/components/StickyHeader.svelte';

	let { data }: { data: PageData } = $props();
	let { server: initialServer, localAgentChecksum, localAgentVersion } = $derived(data);

	// Initialize as state to allow mutations and UI updates
	let server = $state(untrack(() => initialServer || null));
	let isDebugTerminalOpen = $state(false);
	let isTerminalOpen = $state(false);
	let isKeyManagerOpen = $state(false);

	// Check if server is ready to be managed (has SSH key or agent installed)
	let isServerReady = $derived(server?.privateKeyId != null || server?.connectionType === 'agent');

	// Reactive "last seen" text — updates every second
	let now = $state(Date.now());
	$effect(() => {
		const tick = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(tick);
	});
	let lastSeenText = $derived.by(() => {
		const ts = server?.healthUpdatedAt;
		if (!ts) return null;
		const secs = Math.max(0, Math.floor((now - ts * 1000) / 1000));
		if (secs < 60) return `${secs}s ago`;
		const mins = Math.floor(secs / 60);
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		const days = Math.floor(hrs / 24);
		return `${days}d ago`;
	});
	let notReadyMessage = $derived(
		!server?.privateKeyId && server?.connectionType !== 'agent'
			? 'Attach a deployment key or install the agent to manage this server'
			: ''
	);

	// Sync state when data changes (navigation)
	$effect(() => {
		if (data.server) {
			server = data.server;
			proxyType = data.server.proxyType || 'traefik';
			proxyStatus = data.server.proxyStatus || 'stopped';
		}
	});

	// Polling for health data
	$effect(() => {
		if (!server || server.connectionType !== 'agent') return;

		const interval = setInterval(async () => {
			try {
				const response = await getServerStatus({ serverId: server.id });
				if (response.success && response.data) {
					const updated = response.data;
					if (updated.status) {
						server.status = updated.status.toLowerCase() as any;
					}
					// Update agent metadata
					if (updated.agent_version || updated.agentVersion) {
						server.agentVersion = updated.agent_version ?? updated.agentVersion;
					}
					if (updated.agent_installed_at || updated.agentInstalledAt) {
						const installedAt = updated.agent_installed_at ?? updated.agentInstalledAt;
						server.agentInstalledAt =
							typeof installedAt === 'number' ? installedAt * 1000 : installedAt;
					}
					// Map snake_case from API to camelCase for UI
					server.healthCpu = updated.health_cpu ?? updated.healthCpu;
					server.healthMemory = updated.health_memory ?? updated.healthMemory;
					server.healthDisk = updated.health_disk ?? updated.healthDisk;
					server.healthUpdatedAt = updated.health_updated_at ?? updated.healthUpdatedAt;
				}
			} catch (err) {}
		}, 5000);

		return () => clearInterval(interval);
	});

	let isSaving = $state(false);
	let isValidating = $state(false);
	let isInstallingAgent = $state(false);
	let isRestartingAgent = $state(false);
	let isLoadingReverseDns = $state(false);
	let isUpdatingReverseDns = $state(false);
	let reverseDnsData = $state<{
		ipv4s: Array<{ ip: string; reverse: string | null }>;
		ipv6s: Array<{ ip: string; reverse: string | null }>;
	}>({
		ipv4s: [],
		ipv6s: []
	});
	let isRebootingServer = $state(false);
	let isRebootDialogOpen = $state(false);
	let logScrollContainer2 = $state<HTMLDivElement | null>(null);
	let selectedRebootType = $state<'intelligent' | 'graceful' | 'hard' | null>(null);
	let installProgress = $state<
		{ step: string; message: string; status: 'pending' | 'in-progress' | 'success' | 'error' }[]
	>([]);
	let installLogs = $state('');
	let showInstallLogs = $state(false);
	let showDeleteDialog = $state(false);
	let newTag = $state('');
	// Initialize with data.tunnelUrl if present, OR keep existing if re-navigating
	let callbackUrl = $state(
		untrack(() => {
			if (data.tunnelUrl) return data.tunnelUrl.replace('https://', 'wss://');
			if (typeof window !== 'undefined') {
				const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
				return `${protocol}//${window.location.host}`;
			}
			return '';
		})
	);
	let isStartingTunnel = $state(false);

	// Update callbackUrl if data.tunnelUrl changes (e.g. from server load)
	$effect(() => {
		if (data.tunnelUrl) {
			const newUrl = data.tunnelUrl.replace('https://', 'wss://');
			if (callbackUrl !== newUrl) {
				callbackUrl = newUrl;
			}
		}
	});

	let isProxyActionLoading = $state(false);
	let proxyType = $state(untrack(() => data.server?.proxyType) || 'traefik');
	let proxyStatus = $state(untrack(() => data.server?.proxyStatus) || 'stopped');
	let proxyProgress = $state<
		{ step: string; message: string; status: 'pending' | 'in-progress' | 'success' | 'error' }[]
	>([]);
	let isDeployingProxy = $state(false);

	// Quick Deploy state
	let selectedDomain = $state('');
	let appName = $state('hello-world');
	let isDeployingApp = $state(false);
	let deployProgress = $state<
		{ step: string; message: string; status: 'pending' | 'in-progress' | 'success' | 'error' }[]
	>([]);
	let isCheckingReadiness = $state(false);
	let readinessChecks = $state<
		{ name: string; status: string; required: boolean; message: string }[]
	>([]);
	let serverReady = $state(false);

	let appStatuses = $state<Record<string, string>>({});
	let isCheckingAppStatus = $state<Record<string, boolean>>({});
	let isDiagnosing = $state(false);
	let diagnosticsOutput = $state('');
	let showDiagnostics = $state(false);
	let retrievedPassword = $state('');
	let isRetrievingPassword = $state(false);
	let isReinstallDialogOpen = $state(false);
	let isReinstalling = $state(false);
	let showVpsUpdateSheet = $state(false);
	let newVpsApiKey = $state('');
	let isUpdatingVpsKey = $state(false);

	async function handleUpdateVpsKey() {
		if (!server) return;
		if (!newVpsApiKey) {
			toastStore.error('Please enter the API key');
			return;
		}
		isUpdatingVpsKey = true;
		try {
			const result = await updateVpsApiKeyRemote({
				providerId: server.vpsProviderId!,
				apiKey: newVpsApiKey
			});
			if (result.success) {
				toastStore.success(result.message || 'API key updated successfully');
				showVpsUpdateSheet = false;
				newVpsApiKey = '';
				await invalidateAll();
			} else {
				toastStore.error(result.message || 'Failed to update API key');
			}
		} catch (err: any) {
			toastStore.error(err.message || 'Update failed');
		} finally {
			isUpdatingVpsKey = false;
		}
	}

	function checkVpsError(message: string) {
		if (message?.includes('Cloud Provider Unauthorized')) {
			showVpsUpdateSheet = true;
		}
	}
	let serverPassword = $state('');
	let isInstallingKey = $state(false);

	async function handleInstallKeyViaPassword() {
		if (!server) return;
		if (!serverPassword) {
			toastStore.error('Please enter the server password');
			return;
		}
		isInstallingKey = true;
		try {
			const result = await installPrivateKeyRemote({
				serverId: server.id,
				password: serverPassword
			});
			if (result.success) {
				toastStore.success(result.message || 'Deployment key installed successfully');
				serverPassword = '';

				// Optimistically update the key ID if returned
				if (result.data?.privateKeyId) {
					server.privateKeyId = result.data.privateKeyId;
				}

				await invalidateAll();
			} else {
				const msg = result.message || 'Failed to install key';
				toastStore.error(msg);
				checkVpsError(msg);
			}
		} catch (err: any) {
			toastStore.error(err.message || 'Key installation failed');
		} finally {
			isInstallingKey = false;
		}
	}

	async function handleDiagnose() {
		if (!server) return;
		isDiagnosing = true;
		diagnosticsOutput = '';
		try {
			const result = await diagnoseServer({ serverId: server.id });
			if (result.success) {
				diagnosticsOutput = result.output || '';
				showDiagnostics = true;
			} else {
				const msg = result.message || 'Diagnostics failed';
				toastStore.error(msg);
				checkVpsError(msg);
			}
		} catch (err: any) {
			toastStore.error(err.message || 'Failed to run diagnostics');
		} finally {
			isDiagnosing = false;
		}
	}

	let isForceUpdating = $state(false);
	async function handleForceUpdateService() {
		if (!server) return;
		if (!data.tunnelUrl) {
			toastStore.error('No tunnel URL available');
			return;
		}
		isForceUpdating = true;
		try {
			const result = await forceUpdateService({
				serverId: server.id,
				tunnelUrl: data.tunnelUrl.replace('https://', 'wss://')
			});
			if (result.success) {
				toastStore.success('Service forcefully updated! Agent should connect now.');
			} else {
				toastStore.error(result.message || 'Force update failed');
			}
		} catch (err: any) {
			toastStore.error(err.message || 'Failed to force update');
		} finally {
			isForceUpdating = false;
		}
	}

	async function checkAppStatus(appName: string) {
		if (!server || !appName) return;
		isCheckingAppStatus[appName] = true;
		try {
			const result = await getAppStatus({ serverId: server.id, appName });
			if (result.success) {
				appStatuses[appName] = result.status || 'unknown';
			}
		} catch (e) {
		} finally {
			isCheckingAppStatus[appName] = false;
		}
	}

	$effect(() => {
		if (data.deployedApps?.length) {
			data.deployedApps.forEach((app) => {
				// Initialize with DB status
				if (!appStatuses[app.name]) {
					appStatuses[app.name] = app.status;
					// Trigger live check
					checkAppStatus(app.name);
				}
			});
		}
	});

	// Shallow routing for Key Manager
	$effect(() => {
		const searchParams = new URLSearchParams(page.url.search);
		isKeyManagerOpen = searchParams.get('manageKeys') === 'true';
	});

	function closeKeyManager() {
		const url = new URL(page.url);
		url.searchParams.delete('manageKeys');
		goto(url.pathname + url.search, { replaceState: false, noScroll: true, keepFocus: true });
	}

	function openKeyManager() {
		const url = new URL(page.url);
		url.searchParams.set('manageKeys', 'true');
		goto(url.pathname + url.search, { replaceState: false, noScroll: true, keepFocus: true });
	}

	async function handleSave() {
		if (!server) return;
		isSaving = true;
		try {
			// Create a clean payload, ensuring tags is an array
			const payload = {
				name: server.name,
				description: server.description,
				ip: server.ip,
				ipv6: server.ipv6 || null,
				port: Number(server.port),
				user: server.user,
				privateKeyId: server.privateKeyId || null,
				cloudflareTunnelHostname: server.cloudflareTunnelHostname || null,
				cloudflareAccessTokenId: server.cloudflareAccessTokenId || null,
				// Ensure tags is strictly an array of strings, defaulting to empty
				tags: Array.isArray(server.tags) ? [...server.tags] : []
			};

			await serversApi.update(server.id, payload);
			toastStore.success('Server settings saved');
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || error.message || 'Failed to save settings');
		} finally {
			isSaving = false;
		}
	}

	async function handleValidate() {
		if (!server) return;
		isValidating = true;
		try {
			const response = await serversApi.validateConnection(server.id);
			if (response.data?.success) {
				toastStore.success(response.data?.message || 'Connection validated successfully');
			} else {
				toastStore.error(response.data?.message || 'Validation failed: Unknown error');
			}
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Validation failed');
		} finally {
			isValidating = false;
		}
	}

	async function handleRefreshReverseDns() {
		if (!server || !server.vpsProviderId || server.providerName !== 'Vultr') return;

		isLoadingReverseDns = true;
		try {
			const response = await fetch(`/api/servers/${server.id}/reverse-dns`);
			if (response.ok) {
				const data = await response.json();
				reverseDnsData = {
					ipv4s: data.data?.ipv4s || [],
					ipv6s: data.data?.ipv6s || []
				};
			} else {
				const error = await response.json();
				toastStore.error(error.message || 'Failed to load reverse DNS records');
			}
		} catch (error: any) {
			toastStore.error(error.message || 'Failed to load reverse DNS records');
		} finally {
			isLoadingReverseDns = false;
		}
	}

	async function handleUpdateReverseDns(type: 'ipv4' | 'ipv6', ip: string, reverseDns: string) {
		if (!server || !server.vpsProviderId || server.providerName !== 'Vultr') return;

		isUpdatingReverseDns = true;
		try {
			const response = await fetch(`/api/servers/${server.id}/reverse-dns`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type, ip, reverseDns })
			});

			if (response.ok) {
				toastStore.success('Reverse DNS record updated successfully');
				// Refresh the data
				await handleRefreshReverseDns();
			} else {
				const error = await response.json();
				toastStore.error(error.message || 'Failed to update reverse DNS record');
			}
		} catch (error: any) {
			toastStore.error(error.message || 'Failed to update reverse DNS record');
		} finally {
			isUpdatingReverseDns = false;
		}
	}

	// Track active tab to load reverse DNS only when Advanced tab is accessed
	let activeTab = $state('overview');

	$effect(() => {
		const s = server;
		if (s && activeTab === 'advanced' && s.vpsProviderId && s.providerName === 'Vultr') {
			handleRefreshReverseDns();
		}
	});

	async function handleDelete() {
		if (!server) return;
		try {
			const response = await serversApi.delete(server.id);
			toastStore.success('Server removed');
			goto('/servers');
		} catch (error: any) {
			// Handle different error formats
			let errorMessage = 'Failed to remove server';
			if (error.response?.data?.message) {
				errorMessage = error.response.data.message;
			} else if (error.response?.data?.data?.message) {
				errorMessage = error.response.data.data.message;
			} else if (error.message) {
				errorMessage = error.message;
			}
			toastStore.error(errorMessage);
			console.error('Failed to delete server:', error);
		}
	}

	function openRebootConfirmation(type: 'intelligent' | 'graceful' | 'hard') {
		selectedRebootType = type;
		isRebootDialogOpen = true;
	}

	async function handleRebootServer() {
		if (!server || !selectedRebootType) return;

		isRebootingServer = true;
		isRebootDialogOpen = false;

		try {
			const result = await rebootServer({
				serverId: server.id,
				type: selectedRebootType
			});
			if (result.success) {
				toastStore.success(
					`${selectedRebootType.charAt(0).toUpperCase() + selectedRebootType.slice(1)} reboot command sent`
				);
			} else {
				toastStore.error(result.message || 'Failed to reboot server');
			}
		} catch (err: any) {
			toastStore.error(err.message || 'Failed to reboot server');
		} finally {
			isRebootingServer = false;
			selectedRebootType = null;
		}
	}

	async function handleRestartAgent() {
		if (!server) return;
		isRestartingAgent = true;
		server.status = 'restarting';
		try {
			const result = await restartAgent({ serverId: server.id });
			if (result.success) {
				toastStore.success('Restart command sent to agent');
			} else {
				toastStore.error(result.message || 'Failed to restart agent');
			}
		} catch (err: any) {
			toastStore.error(err.message || 'Failed to restart agent');
		} finally {
			isRestartingAgent = false;
		}
	}

	const INSTALL_AGENT_LOG = '[InstallAgent]';

	/** In dev mode, append (or replace on first call) a line to .dev-install-agent.log on the server. */
	function devLog(line: string, replace = false) {
		if (!dev) return;
		const payload = JSON.stringify({ replace, message: line });
		fetch('/api/dev/install-agent-log', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: payload
		}).catch(() => {});
	}

	async function handleInstallAgent() {
		let devLogReplace = true;
		function logStep(step: string, data?: unknown) {
			const line =
				data !== undefined
					? `${INSTALL_AGENT_LOG} ${step} ${JSON.stringify(data)}`
					: `${INSTALL_AGENT_LOG} ${step}`;
			console.log(INSTALL_AGENT_LOG, step, data ?? '');
			devLog(line, devLogReplace);
			devLogReplace = false;
		}

		logStep('1. Button clicked');
		if (!server) {
			logStep('1b. Abort: server missing');
			toastStore.error('Server not available');
			return;
		}

		// Auto-start tunnel in dev if using localhost
		if (
			dev &&
			(!callbackUrl || callbackUrl.includes('localhost') || callbackUrl.includes('127.0.0.1'))
		) {
			logStep('1c. Dev mode + local URL detected, ensuring Magic Tunnel is active...');
			isStartingTunnel = true;
			try {
				const response = await createTunnelRemote();
				if (response.success && response.data) {
					callbackUrl = response.data.url.replace('https://', 'wss://');
					logStep('1d. Magic Tunnel started automatically', { url: callbackUrl });
					toastStore.info('Started Magic Tunnel for remote installation');
				}
			} catch (err) {
				console.error('Failed to auto-start tunnel:', err);
			} finally {
				isStartingTunnel = false;
			}
		}

		const serverId = server.id;
		logStep('2. Starting', { serverId, callbackUrl: callbackUrl || '(empty)' });
		isInstallingAgent = true;
		installLogs = ''; // Reset logs
		installProgress = [
			{ step: 'connecting', message: 'Connecting to server...', status: 'in-progress' as const },
			{
				step: 'detecting',
				message: 'Detecting system configuration...',
				status: 'pending' as const
			},
			{
				step: 'uploading',
				message: 'Uploading SelfHost Agent source...',
				status: 'pending' as const
			},
			{ step: 'installing_bun', message: 'Installing Bun runtime...', status: 'pending' as const },
			{
				step: 'starting',
				message: 'Starting SelfHost Agent service...',
				status: 'pending' as const
			}
		];

		try {
			const url = `/api/servers/${serverId}/install-agent`;
			logStep('3. Fetching', { url });
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ callbackUrl })
			});

			console.log(INSTALL_AGENT_LOG, '4. Response received', {
				ok: response.ok,
				status: response.status,
				statusText: response.statusText,
				hasBody: !!response.body
			});

			if (!response.ok) {
				const text = await response.text();
				console.log(
					INSTALL_AGENT_LOG,
					'4b. Non-OK response body (first 500 chars)',
					text.slice(0, 500)
				);
				let msg = `Install failed (${response.status})`;
				try {
					const json = JSON.parse(text) as { error?: string; message?: string };
					msg = json.error ?? json.message ?? msg;
				} catch {
					if (text.length > 0 && text.length < 200) msg = text;
				}
				toastStore.error(msg);
				return;
			}

			if (!response.body) {
				logStep('4c. Abort: response.body is null');
				toastStore.error('No response from server');
				return;
			}
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			console.log(INSTALL_AGENT_LOG, '5. Reading SSE stream');

			while (true) {
				const { value, done } = await reader.read();
				if (done) {
					console.log(INSTALL_AGENT_LOG, '6. Stream done');
					break;
				}

				buffer += decoder.decode(value, { stream: true });
				const events = buffer.split('\n\n');
				buffer = events.pop() || '';

				for (const event of events) {
					const lines = event.split('\n');
					for (const line of lines) {
						if (line.startsWith('data: ')) {
							try {
								const data = JSON.parse(line.slice(6));
								logStep('7. SSE event', { step: data.step, message: data.message ?? data });
								const index = installProgress.findIndex((p) => p.step === data.step);

								if (index !== -1) {
									// Mark previous steps as success - create new array for reactivity
									installProgress = installProgress.map((p, i) => {
										if (i < index) {
											return { ...p, status: 'success' as const };
										} else if (i === index) {
											return { ...p, status: 'in-progress' as const, message: data.message };
										}
										return p;
									});
								} else if (data.step === 'log') {
									installLogs += data.message;
									setTimeout(() => {
										if (logScrollContainer2) {
											logScrollContainer2.scrollTop = logScrollContainer2.scrollHeight;
										}
									}, 0);
								} else if (data.step === 'complete') {
									console.log(
										INSTALL_AGENT_LOG,
										'8. Complete received, updating UI and invalidating'
									);
									installProgress = installProgress.map((p) => ({
										...p,
										status: 'success' as const
									}));
									if (server) server.connectionType = 'agent';

									// Automatically force-update the service config to ensure it's correct
									if (data.tunnelUrl && serverId) {
										try {
											const updateResult = await forceUpdateService({
												serverId,
												tunnelUrl: data.tunnelUrl.replace('https://', 'wss://')
											});
											if (!updateResult.success) {
											}
										} catch (e) {}
									}

									toastStore.success('SelfHost Agent installed successfully!');

									// Invalidate page data to refresh server status (will update from "waiting" to "online" when agent connects)
									try {
										await invalidateAll();
										logStep('9. invalidateAll() finished');
									} catch (invErr: unknown) {
										const errMsg =
											invErr && typeof invErr === 'object' && 'message' in invErr
												? String((invErr as Error).message)
												: String(invErr);
										logStep('9b. invalidateAll() threw', { err: errMsg });
									}
								} else if (data.step === 'error') {
									logStep('8b. Error event', data.message);
									const errorIndex = installProgress.findIndex(
										(p) => p.status === 'in-progress' || p.status === 'pending'
									);
									if (errorIndex !== -1) {
										installProgress = installProgress.map((p, i) =>
											i === errorIndex
												? { ...p, status: 'error' as const, message: data.message }
												: p
										);
									}
									toastStore.error(data.message);
								}
							} catch (parseErr) {
								console.warn(
									INSTALL_AGENT_LOG,
									'7b. SSE line parse failed',
									line.slice(0, 80),
									parseErr
								);
							}
						}
					}
				}
			}
		} catch (err: any) {
			logStep('10. Caught error', { message: err?.message ?? err });
			toastStore.error(err.message || 'Installation failed');
		} finally {
			logStep('11. Finally: isInstallingAgent = false');
			isInstallingAgent = false;
		}
	}

	async function handleMagicTunnel() {
		isStartingTunnel = true;
		try {
			const response = await createTunnelRemote();
			if (response.success && response.data) {
				const { url } = response.data;
				callbackUrl = url.replace('https://', 'wss://');
				toastStore.success('Tunnel active! Configuration updated.');
			} else {
				toastStore.error(response.message || 'Failed to start tunnel');
			}
		} catch (err: any) {
			toastStore.error(err.message || 'Tunnel error');
		} finally {
			isStartingTunnel = false;
		}
	}

	async function handleProxyAction(action: 'start' | 'stop' | 'restart') {
		if (!server) return;
		if (action === 'start') {
			// Use SSE for deployment
			isDeployingProxy = true;
			proxyProgress = [
				{ step: 'network', message: 'Preparing...', status: 'pending' },
				{ step: 'config', message: 'Waiting...', status: 'pending' },
				{ step: 'upload', message: 'Waiting...', status: 'pending' },
				{ step: 'deploy', message: 'Waiting...', status: 'pending' }
			];

			try {
				const eventSource = new EventSource(`/api/servers/${server.id}/proxy/deploy`);

				eventSource.onmessage = (event) => {
					const data = JSON.parse(event.data);

					if (data.step === 'complete') {
						proxyProgress.forEach((p) => (p.status = 'success'));
						proxyStatus = 'running';
						toastStore.success('Proxy deployed successfully!');
						eventSource.close();
						isDeployingProxy = false;
					} else if (data.step === 'error') {
						const current =
							proxyProgress.find((p) => p.status === 'in-progress') ||
							proxyProgress.find((p) => p.status === 'pending');
						if (current) {
							current.status = 'error';
							current.message = data.message;
						}
						toastStore.error(data.message);
						eventSource.close();
						isDeployingProxy = false;
					} else {
						const index = proxyProgress.findIndex((p) => p.step === data.step);
						if (index !== -1) {
							// Mark previous steps as success
							for (let i = 0; i < index; i++) {
								if (proxyProgress[i].status !== 'success') {
									proxyProgress[i].status = 'success';
								}
							}
							proxyProgress[index].status = data.status || 'in-progress';
							proxyProgress[index].message = data.message;
						}
					}
				};

				eventSource.onerror = () => {
					toastStore.error('Connection lost during deployment');
					eventSource.close();
					isDeployingProxy = false;
				};
			} catch (err: any) {
				toastStore.error(err.message || 'Deployment failed');
				isDeployingProxy = false;
			}
		} else {
			// Simple action for stop/restart
			isProxyActionLoading = true;
			try {
				const result = await proxyAction({
					serverId: server.id,
					action,
					type: proxyType
				});
				if (result.success) {
					toastStore.success(result.message || 'Proxy updated');
					if (action === 'stop') proxyStatus = 'stopped';
				} else {
					toastStore.error(result.message || 'Failed to update proxy');
				}
			} catch (err: any) {
				toastStore.error(err.message || 'Proxy error');
			} finally {
				isProxyActionLoading = false;
			}
		}
	}

	async function handleDeployApp() {
		if (!server) return;
		isDeployingApp = true;
		deployProgress = [
			{ step: 'prepare', message: 'Preparing...', status: 'pending' },
			{ step: 'upload', message: 'Waiting...', status: 'pending' },
			{ step: 'systemd', message: 'Waiting...', status: 'pending' },
			{ step: 'traefik', message: 'Waiting...', status: 'pending' },
			{ step: 'start', message: 'Waiting...', status: 'pending' }
		];

		try {
			const response = await fetch(`/api/servers/${server.id}/deploy`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ appName, domain: selectedDomain })
			});

			if (!response.ok || !response.body) {
				throw new Error('Deployment failed to start');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();

				if (done) {
					break;
				}

				// Accumulate chunks
				buffer += decoder.decode(value, { stream: true });

				// Process complete messages (separated by double newlines)
				const messages = buffer.split('\n\n');
				buffer = messages.pop() || ''; // Keep incomplete message in buffer

				for (const message of messages) {
					if (!message.trim()) continue;

					// Parse SSE format: "data: {...}"
					const lines = message.split('\n');
					for (const line of lines) {
						if (line.startsWith('data: ')) {
							try {
								const data = JSON.parse(line.slice(6));

								if (data.step === 'complete') {
									deployProgress.forEach((p) => (p.status = 'success'));
									toastStore.success(data.message);
									isDeployingApp = false;
								} else if (data.step === 'error') {
									const current =
										deployProgress.find((p) => p.status === 'in-progress') ||
										deployProgress.find((p) => p.status === 'pending');
									if (current) {
										current.status = 'error';
										current.message = data.message;
									}
									toastStore.error(data.message);
									isDeployingApp = false;
								} else {
									const index = deployProgress.findIndex((p) => p.step === data.step);
									if (index !== -1) {
										// Mark previous steps as success
										for (let i = 0; i < index; i++) {
											if (deployProgress[i].status !== 'success') {
												deployProgress[i].status = 'success';
											}
										}
										deployProgress[index].status = data.status || 'in-progress';
										deployProgress[index].message = data.message;
									}
								}
							} catch (err) {}
						}
					}
				}
			}
		} catch (err: any) {
			toastStore.error(err.message || 'Deployment failed');
			isDeployingApp = false;
		}
	}

	let debugLogs = $state('');
	let logEventSource = $state<EventSource | null>(null);
	let hasConnected = $state(false);
	let logScrollContainer = $state<HTMLDivElement | null>(null);

	function startLogStream() {
		if (!server || logEventSource) return;

		// Reset logs on fresh open to avoid duplication from tail history
		debugLogs = '';
		hasConnected = false;

		const es = new EventSource(`/api/servers/${server.id}/logs/stream`);
		logEventSource = es;

		es.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === 'status') {
					if (data.message === 'initializing') {
						// Show immediate feedback that connection is starting
						debugLogs = '[System] Initializing connection...\n';
					} else if (data.message === 'connecting_via_tunnel') {
						debugLogs = '[System] Connecting via Cloudflare tunnel...\n';
					} else if (data.message === 'connected') {
						hasConnected = true;
						debugLogs += '[System] Connection established. Streaming logs...\n';
					}
				}
				if (data.log) {
					hasConnected = true;
					debugLogs += data.log;

					// Auto-scroll on next tick
					setTimeout(() => {
						if (logScrollContainer) {
							logScrollContainer.scrollTop = logScrollContainer.scrollHeight;
						}
					}, 0);
				}
				if (data.error) {
					hasConnected = true;
					debugLogs += `\n[Error] ${data.error}\n`;
				}
			} catch (e) {}
		};

		es.onerror = () => {
			// Only close if we really lost it. Browsers auto-retry, but we might want to show error.
			// If we close it, it stops retrying.
			es.close();
			logEventSource = null;
			debugLogs += '\n[Connection closed - Click Refresh to reconnect]\n';
		};
	}

	function stopLogStream() {
		if (logEventSource) {
			logEventSource.close();
			logEventSource = null;
		}
	}

	$effect(() => {
		if (isDebugTerminalOpen) {
			startLogStream();
		} else {
			stopLogStream();
		}

		return () => stopLogStream();
	});

	async function handleCheckReadiness() {
		if (!server) return;
		isCheckingReadiness = true;
		try {
			const result = await checkReadiness({ serverId: server.id });
			if (result.success) {
				serverReady = result.ready || false;
				readinessChecks = result.checks || [];
				if (result.ready) {
					toastStore.success('Server is ready for deployments!');
				} else {
					toastStore.warning(result.message || 'Readiness check failed');
				}
			} else {
				toastStore.error(result.message || 'Failed to check server readiness');
			}
		} catch (err: any) {
			toastStore.error(err.message || 'Readiness check failed');
		} finally {
			isCheckingReadiness = false;
		}
	}
</script>

{#if server}
	<PageTitle title={server.name} />

	<div class="space-y-6">
		<Tabs.Root value={activeTab} onValueChange={(value) => (activeTab = value)} class="space-y-6">
			<StickyHeader class="space-y-4">
				<div class="flex flex-col gap-4 pb-6 md:flex-row md:items-center md:justify-between">
					<div class="flex flex-col gap-1">
						<div class="text-muted-foreground flex items-center gap-2 text-sm">
							<a href="/servers" class="hover:underline">Servers</a>
							<ChevronRight class="size-3" />
							<span>{server.name}</span>
						</div>
						<div class="flex items-center gap-3">
							<h1 class="text-3xl font-bold tracking-tight">{server.name}</h1>
							<Badge
								variant="outline"
								class={server.status === 'online'
									? 'border-green-200 text-green-600'
									: server.status === 'waiting'
										? 'border-amber-200 text-amber-600'
										: server.status === 'restarting'
											? 'border-blue-200 text-blue-600'
											: 'text-destructive border-destructive/20'}
							>
								{server.status === 'online'
									? 'Online'
									: server.status === 'waiting'
										? 'Waiting'
										: server.status === 'restarting'
											? 'Restarting'
											: 'Offline'}
							</Badge>
							<div class="ml-2 flex items-center gap-1.5">
								<Badge variant="secondary" class="px-3 py-1 text-sm font-semibold uppercase">
									{server.application_count || 0} Apps
								</Badge>
								<Badge variant="secondary" class="px-3 py-1 text-sm font-semibold uppercase">
									{server.database_count || 0} DBs
								</Badge>
								{#if server.providerName}
									<Badge variant="secondary" class="px-3 py-1 text-sm font-semibold uppercase">
										{server.providerName}
									</Badge>
								{/if}
							</div>
						</div>
					</div>

					{#if server.connectionType === 'agent' && server.status === 'waiting'}
						<div class="rounded-lg border border-amber-200 bg-amber-500/10 px-4 py-3">
							<p class="text-amber-800 dark:text-amber-200 text-sm font-medium">
								Agent hasn't connected yet. Run <strong>Run diagnostics</strong> below to check the service and logs on the server (over SSH). If the agent was installed before recent fixes, <strong>Reinstall Agent</strong> to apply the latest fixes (Bun path, etc.).
							</p>
						</div>
					{/if}

					{#if server.connectionType === 'agent'}
						<div
							class="bg-muted/20 hidden items-center gap-6 rounded-full border px-6 py-2 lg:flex"
						>
							<div class="flex w-24 flex-col gap-1">
								<div
									class="text-muted-foreground flex justify-between text-[10px] font-bold tracking-wider uppercase"
								>
									<span>CPU</span>
									<span>{server.healthCpu || 0}%</span>
								</div>
								<div class="bg-muted h-1.5 w-full overflow-hidden rounded-full">
									<div
										class="bg-primary h-full transition-all duration-500"
										style="width: {server.healthCpu || 0}%"
									></div>
								</div>
							</div>
							<div class="flex w-24 flex-col gap-1">
								<div
									class="text-muted-foreground flex justify-between text-[10px] font-bold tracking-wider uppercase"
								>
									<span>RAM</span>
									<span>{server.healthMemory || 0}%</span>
								</div>
								<div class="bg-muted h-1.5 w-full overflow-hidden rounded-full">
									<div
										class="bg-primary h-full transition-all duration-500"
										style="width: {server.healthMemory || 0}%"
									></div>
								</div>
							</div>
							<div class="flex w-24 flex-col gap-1">
								<div
									class="text-muted-foreground flex justify-between text-[10px] font-bold tracking-wider uppercase"
								>
									<span>DISK</span>
									<span>{server.healthDisk || 0}%</span>
								</div>
								<div class="bg-muted h-1.5 w-full overflow-hidden rounded-full">
									<div
										class="bg-primary h-full transition-all duration-500"
										style="width: {server.healthDisk || 0}%"
									></div>
								</div>
							</div>
							{#if lastSeenText}
								<div class="border-l pl-4 flex flex-col items-center gap-0.5">
									<span class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">Seen</span>
									<span class="text-xs tabular-nums">{lastSeenText}</span>
								</div>
							{/if}
						</div>
					{/if}

					<div class="flex gap-2">
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant="outline"
										size="sm"
										onclick={handleValidate}
										disabled={isValidating || !isServerReady}
									>
										<RefreshCcw class="mr-2 size-4 {isValidating ? 'animate-spin' : ''}" />
										Validate
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							{#if !isServerReady}
								<Tooltip.Content>
									<p>{notReadyMessage}</p>
								</Tooltip.Content>
							{/if}
						</Tooltip.Root>

						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant="outline"
										size="sm"
										onclick={() => (isTerminalOpen = true)}
										disabled={!isServerReady}
									>
										<TerminalIcon class="mr-2 size-4" />
										Terminal
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							{#if !isServerReady}
								<Tooltip.Content>
									<p>{notReadyMessage}</p>
								</Tooltip.Content>
							{/if}
						</Tooltip.Root>

						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant="outline"
										size="sm"
										onclick={() => (isDebugTerminalOpen = true)}
										disabled={!isServerReady}
									>
										<Activity class="mr-2 size-4" />
										Debug Logs
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							{#if !isServerReady}
								<Tooltip.Content>
									<p>{notReadyMessage}</p>
								</Tooltip.Content>
							{/if}
						</Tooltip.Root>

						{#if server.connectionType === 'agent'}
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant="outline"
											size="sm"
											disabled={isRebootingServer}
											class="border-orange-200 text-orange-500 hover:bg-orange-50 hover:text-orange-600 dark:border-orange-900/30 dark:hover:bg-orange-950/20"
										>
											<RotateCcw class="mr-2 size-4 {isRebootingServer ? 'animate-spin' : ''}" />
											{isRebootingServer ? 'Rebooting...' : 'Restart'}
											<ChevronDown class="ml-2 size-4 opacity-50" />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end" class="w-72">
									<DropdownMenu.Item
										onclick={() => openRebootConfirmation('intelligent')}
										class="flex cursor-pointer flex-col items-start gap-1 p-3"
									>
										<div class="flex items-center gap-2 text-sm font-bold">
											<Zap class="size-4 text-yellow-500" />
											<span>Intelligent Restart</span>
										</div>
										<p class="text-muted-foreground text-xs leading-normal font-medium">
											Safe restart with traffic management & DNS TTL handling.
										</p>
									</DropdownMenu.Item>

									<DropdownMenu.Separator />

									<DropdownMenu.Item
										onclick={() => openRebootConfirmation('graceful')}
										class="flex cursor-pointer flex-col items-start gap-1 p-3"
									>
										<div class="flex items-center gap-2 text-sm font-bold">
											<RefreshCw class="size-4 text-blue-500" />
											<span>Less than Graceful</span>
										</div>
										<p class="text-muted-foreground text-xs leading-normal font-medium">
											Immediate graceful restart without advanced handling.
										</p>
									</DropdownMenu.Item>

									<DropdownMenu.Separator />

									<DropdownMenu.Item
										onclick={() => openRebootConfirmation('hard')}
										class="text-destructive focus:text-destructive flex cursor-pointer flex-col items-start gap-1 p-3"
									>
										<div class="flex items-center gap-2 text-sm font-bold">
											<ShieldAlert class="size-4" />
											<span>Hard Restart</span>
										</div>
										<p class="text-xs leading-normal font-medium whitespace-normal opacity-70">
											Force restart upstream with cloud provider.
										</p>
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						{/if}
						<Button size="sm" onclick={handleSave} disabled={isSaving}>
							<Save class="mr-2 size-4" />
							Save
						</Button>
					</div>
				</div>

				<Tabs.List class="h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
					<Tabs.Trigger
						value="overview"
						class="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:bg-transparent"
						>Overview</Tabs.Trigger
					>
					<Tabs.Trigger
						value="quickdeploy"
						class="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:bg-transparent"
						>Quick Deploy</Tabs.Trigger
					>
					<Tabs.Trigger
						value="apps"
						class="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:bg-transparent"
					>
						Deployed Apps
						{#if data.deployedApps && data.deployedApps.length > 0}
							<Badge variant="secondary" class="ml-2">{data.deployedApps.length}</Badge>
						{/if}
					</Tabs.Trigger>
					{#if server.vpsProviderId && server.providerName === 'Vultr'}
						<Tabs.Trigger
							value="advanced"
							class="data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:bg-transparent"
						>
							Advanced
						</Tabs.Trigger>
					{/if}
				</Tabs.List>
			</StickyHeader>
			<Tabs.Content value="overview" class="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_240px]">
				<div class="space-y-12">
					<!-- Cloud Connection Section -->
					{#if server.vpsProviderId}
						<section id="cloud-connection" class="space-y-4">
							<div class="space-y-1">
								<h2 class="text-xl font-bold tracking-tight">Cloud Connection</h2>
								<p class="text-muted-foreground text-sm">
									Securely connect to your cloud provider's API. This allows SelfHost to perform
									actions like hard reboots, OS reinstalls, and password retrieval directly through
									the provider's infrastructure.
								</p>
							</div>
							<Card.Root>
								<Card.Header>
									<Card.Title>Cloud Connection</Card.Title>
									<Card.Description>
										Managed via {server.providerName || 'Cloud Provider'}
									</Card.Description>
								</Card.Header>
								<Card.Content>
									<div class="flex items-center gap-4">
										<div class="flex-1">
											<Label>Default Root Password</Label>
											<div class="flex items-center gap-2">
												{#if retrievedPassword}
													<div
														class="bg-muted text-foreground relative flex h-10 w-full items-center rounded-md border px-3 font-mono text-sm"
													>
														{retrievedPassword}
														<Button
															variant="ghost"
															size="icon"
															class="absolute top-1/2 right-1 -translate-y-1/2"
															onclick={() => {
																navigator.clipboard.writeText(retrievedPassword);
																toastStore.success('Password copied');
															}}
														>
															<Copy class="size-4" />
														</Button>
													</div>
												{:else}
													<div class="text-muted-foreground text-sm italic">
														Hidden for security. Retrieve from provider API.
													</div>
												{/if}
											</div>
										</div>
										<form
											method="POST"
											action="?/retrievePassword"
											use:enhance={() => {
												isRetrievingPassword = true;
												return async ({ result }) => {
													isRetrievingPassword = false;
													if (result.type === 'success' && result.data?.password) {
														retrievedPassword = result.data.password as string;
														toastStore.success('Password retrieved');
													} else if (result.type === 'failure') {
														toastStore.error(
															(result.data?.message as string) || 'Failed to retrieve password'
														);
													}
												};
											}}
										>
											<Button type="submit" variant="outline" disabled={isRetrievingPassword}>
												{isRetrievingPassword ? 'Retrieving...' : 'Retrieve Password'}
											</Button>
										</form>
									</div>
								</Card.Content>

								<!-- Reinstall Option -->
								<div class="border-t px-6 pt-0 pb-6">
									<h4 class="mb-2 text-sm font-medium">Troubleshooting</h4>
									<div class="flex items-center justify-between gap-4">
										<div class="text-muted-foreground text-xs">
											If you cannot access the server, you can perform a full OS reinstall.
											<span class="text-destructive mt-1 block font-bold">
												Warning: This will wipe all data on the server!
											</span>
										</div>
										<Button
											variant="destructive"
											size="sm"
											onclick={() => (isReinstallDialogOpen = true)}
											disabled={isReinstalling}
										>
											{isReinstalling ? 'Reinstalling...' : 'Reinstall OS'}
										</Button>
									</div>
								</div>
							</Card.Root>

							<Dialog.Root bind:open={isReinstallDialogOpen}>
								<Dialog.Content>
									<Dialog.Header>
										<Dialog.Title>Reinstall Server OS</Dialog.Title>
										<Dialog.Description>
											This action will permanently delete all data on the server <strong
												>{server.name}</strong
											>
											({server.ip}). The operating system will be reinstalled to its original state.
										</Dialog.Description>
									</Dialog.Header>

									<div
										class="bg-destructive/10 text-destructive border-destructive/20 my-2 rounded-md border p-3 text-sm"
									>
										<div class="flex items-center gap-2 font-bold">
											<ShieldAlert class="size-4" />
											Critical Warning
										</div>
										<ul class="mt-2 list-inside list-disc space-y-1">
											<li>Filesystem will be wiped</li>
											<li>All applications and databases will be lost</li>
											<li>Server host key will change</li>
											<li>This action cannot be undone</li>
										</ul>
									</div>

									<Dialog.Footer>
										<Button variant="outline" onclick={() => (isReinstallDialogOpen = false)}
											>Cancel</Button
										>
										<form
											method="POST"
											action="?/reinstall"
											use:enhance={() => {
												isReinstalling = true;
												return async ({ result }) => {
													isReinstalling = false;
													isReinstallDialogOpen = false;
													if (result.type === 'success') {
														toastStore.success('Server reinstall initiated');
														server.status = 'reinstalling';
													} else if (result.type === 'failure') {
														const msg =
															(result.data?.message as string) || 'Failed to reinstall server';
														toastStore.error(msg);
														checkVpsError(msg);
													} else if (result.type === 'error') {
														toastStore.error('An unexpected error occurred');
													}
												};
											}}
										>
											<Button type="submit" variant="destructive"
												>I Understand, Reinstall Server</Button
											>
										</form>
									</Dialog.Footer>
								</Dialog.Content>
							</Dialog.Root>
						</section>
					{/if}

					<!-- Configuration Section -->
					<section id="configuration" class="space-y-4">
						<div class="space-y-1">
							<h2 class="text-xl font-bold tracking-tight">Server Configuration</h2>
							<p class="text-muted-foreground text-sm">
								Manage the core identity of your server. Update the display name, description, and
								network connectivity details like IP addresses and SSH ports used for system
								operations.
							</p>
						</div>

						<Card.Root>
							<Card.Header>
								<div class="flex items-center justify-between">
									<div>
										<Card.Title>Server Configuration</Card.Title>
										<Card.Description
											>Update server details and connection parameters.</Card.Description
										>
									</div>
									<div class="flex gap-2">
										{#if server.vpsProviderId}
											<Badge
												variant="outline"
												class="flex items-center gap-1.5 border-blue-200 bg-blue-50/50 py-1 text-[10px] font-bold text-blue-600 uppercase"
											>
												<Cloud class="size-3" />
												{server.providerName || 'Cloud Managed'}
											</Badge>
										{/if}
										{#if server.datacenter}
											<Badge
												variant="outline"
												class="text-muted-foreground flex items-center gap-1.5 py-1 text-[10px] font-bold uppercase"
											>
												<MapPin class="size-3" />
												{server.datacenter}
											</Badge>
										{/if}
									</div>
								</div>
							</Card.Header>
							<Card.Content class="space-y-10">
								<!-- General Metadata -->
								<div class="space-y-6">
									<div
										class="text-muted-foreground flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase"
									>
										<div class="bg-primary/10 flex size-5 items-center justify-center rounded-md">
											<ServerIcon class="text-primary size-3" />
										</div>
										Identity & Metadata
									</div>
									<div class="grid gap-x-8 gap-y-6 md:grid-cols-2">
										<div class="space-y-2">
											<Label for="name">Display Name</Label>
											<Input
												id="name"
												bind:value={server.name}
												placeholder="e.g. Production Web-01"
											/>
											<p class="text-muted-foreground text-[10px]">
												Friendly name for your server in the dashboard.
											</p>
										</div>
										<div class="space-y-2">
											<Label for="description">Description</Label>
											<Input
												id="description"
												bind:value={server.description}
												placeholder="Briefly describe this server's role..."
											/>
											<p class="text-muted-foreground text-[10px]">
												What is this server primarily used for?
											</p>
										</div>
										<div class="space-y-3 md:col-span-2">
											<Label>Tags</Label>
											<div
												class="bg-muted/30 flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3"
											>
												{#if (server.tags || []).length === 0}
													<span class="text-muted-foreground text-[10px] italic"
														>No tags assigned.</span
													>
												{/if}
												{#each server.tags || [] as tag}
													<Badge
														variant="secondary"
														class="bg-background/80 flex items-center gap-1 border px-2 py-1 shadow-sm backdrop-blur-sm"
													>
														<Tag class="size-3" />
														{tag}
														<button
															onclick={() => {
																server.tags = (server.tags || []).filter((t: string) => t !== tag);
															}}
															class="hover:text-destructive ml-1 transition-colors"
														>
															<X class="size-3" />
														</button>
													</Badge>
												{/each}
												<div class="ml-auto flex gap-2">
													<Input
														placeholder="Add tag..."
														class="h-8 w-32 text-xs"
														bind:value={newTag}
														onkeydown={(e) => {
															if (e.key === 'Enter') {
																e.preventDefault();
																if (newTag.trim() && !server.tags?.includes(newTag.trim())) {
																	server.tags = [...(server.tags || []), newTag.trim()];
																	newTag = '';
																}
															}
														}}
													/>
													<Button
														type="button"
														variant="outline"
														size="sm"
														class="h-8 px-3 text-xs"
														onclick={() => {
															if (newTag.trim() && !server.tags?.includes(newTag.trim())) {
																server.tags = [...(server.tags || []), newTag.trim()];
																newTag = '';
															}
														}}
													>
														<Plus class="mr-1 size-3" /> Add
													</Button>
												</div>
											</div>
										</div>
									</div>
								</div>

								<div class="bg-border/40 h-px w-full"></div>

								<!-- Connection Settings -->
								<div class="space-y-6">
									<div
										class="text-muted-foreground flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase"
									>
										<div class="bg-primary/10 flex size-5 items-center justify-center rounded-md">
											<Network class="text-primary size-3" />
										</div>
										SSH Access & Network
									</div>
									<div class="grid gap-x-8 gap-y-6 md:grid-cols-2">
										<div class="space-y-2">
											<Label for="ip">Primary IPv4 Address / FQDN</Label>
											<div class="relative">
												<Input id="ip" bind:value={server.ip} placeholder="1.2.3.4" class="pl-9" />
												<Globe
													class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
												/>
											</div>
										</div>
										<div class="space-y-2">
											<Label for="ipv6">IPv6 Address (Optional)</Label>
											<Input id="ipv6" bind:value={server.ipv6} placeholder="2001:db8::1" />
										</div>

										<div class="grid grid-cols-2 gap-4">
											<div class="space-y-2">
												<Label for="user">SSH User</Label>
												<Input id="user" bind:value={server.user} placeholder="root" />
											</div>
											<div class="space-y-2">
												<Label for="port">SSH Port</Label>
												<Input id="port" type="number" bind:value={server.port} placeholder="22" />
											</div>
										</div>

										<div class="space-y-2">
											<Label for="privateKey">Deployment Key</Label>
											<div class="flex gap-2">
												<select
													id="privateKey"
													bind:value={server.privateKeyId}
													class="bg-background border-input ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
												>
													<option value={null}>No key selected</option>
													{#each data.privateKeys as key}
														<option value={key.id}>{key.name}</option>
													{/each}
												</select>
												<Button
													variant="outline"
													size="icon"
													title="Manage Keys"
													onclick={openKeyManager}
												>
													<Key class="size-4" />
												</Button>
											</div>
										</div>

										<!-- Cloudflare Tunnel Support -->
										<div
											class="space-y-4 rounded-lg border-2 border-dashed border-orange-500/20 bg-orange-500/5 p-4 md:col-span-2"
										>
											<div
												class="flex items-center gap-2 text-sm font-bold tracking-tight text-orange-600 uppercase dark:text-orange-400"
											>
												<ShieldCheck class="size-4" />
												Cloudflare Tunnel (Optional)
											</div>
											<div class="grid gap-4 md:grid-cols-2">
												<div class="space-y-2">
													<Label for="cfHostname">Tunnel Hostname</Label>
													<Input
														id="cfHostname"
														bind:value={server.cloudflareTunnelHostname}
														placeholder="e.g. tunnel.example.com"
													/>
													<p class="text-muted-foreground text-[10px]">
														Connecting via tunnel bypasses firewalls.
													</p>
												</div>
												<div class="space-y-2">
													<Label for="cfToken">Cloudflare Access Token</Label>
													<select
														id="cfToken"
														bind:value={server.cloudflareAccessTokenId}
														class="bg-background border-input ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
													>
														<option value={null}>No Service Token</option>
														{#each data.accessTokens as token}
															<option value={token.id}>{token.name}</option>
														{/each}
													</select>
													<p class="text-muted-foreground text-[10px]">
														Required if the tunnel has Access policies.
													</p>
												</div>
											</div>
										</div>

										{#if !server.privateKeyId}
											<div
												class="border-warning-border bg-warning mt-2 space-y-4 rounded-lg border p-4 transition-colors"
											>
												<div class="flex items-start gap-3">
													<ShieldAlert class="text-warning-muted mt-0.5 size-5 shrink-0" />
													<div class="flex-1 space-y-4">
														<div>
															<p class="text-warning-foreground text-sm font-medium">
																No deployment key configured
															</p>
															<p class="text-warning-foreground/80 mt-1 text-xs">
																A deployment key is required for SelfHost to manage this server. You
																can install an auto-generated key using a password, or use
																provider-specific options below.
															</p>
														</div>

														<div class="flex flex-col gap-3">
															<div class="flex max-w-sm flex-col gap-2">
																<Label
																	for="serverPassword"
																	class="text-warning-muted text-xs font-semibold uppercase"
																	>Server Root/User Password</Label
																>
																<div class="flex gap-2">
																	<Input
																		id="serverPassword"
																		type="password"
																		bind:value={serverPassword}
																		placeholder="Enter password..."
																		class="bg-warning-foreground/5 border-warning-border text-warning-foreground placeholder:text-warning-foreground/40 focus-visible:ring-warning-muted"
																	/>
																	<Button
																		size="sm"
																		onclick={handleInstallKeyViaPassword}
																		disabled={isInstallingKey}
																		class="bg-amber-600 hover:bg-amber-700"
																	>
																		{#if isInstallingKey}
																			<Loader2 class="size-3 animate-spin" />
																		{:else}
																			<Key class="mr-2 size-3" />
																			Generate and Install Key
																		{/if}
																	</Button>
																</div>
															</div>

															{#if server.vpsProviderId}
																<div class="border-warning-border border-t pt-2">
																	<p
																		class="text-warning-muted mb-3 text-[10px] font-bold uppercase"
																	>
																		Provider Actions
																	</p>
																	<div class="flex flex-wrap gap-2">
																		<Button
																			variant="outline"
																			size="sm"
																			onclick={() => (isReinstallDialogOpen = true)}
																			disabled={isReinstalling}
																			class="border-warning-border bg-warning-foreground/5 text-warning-foreground hover:bg-warning-foreground/10"
																		>
																			{#if isReinstalling}
																				<Loader2 class="mr-2 size-3 animate-spin" />
																				Reinstalling...
																			{:else}
																				<Key class="mr-2 size-3" />
																				Auto-Generate & Reinstall
																			{/if}
																		</Button>
																		<Button
																			variant="outline"
																			size="sm"
																			onclick={async () => {
																				isRetrievingPassword = true;
																				const formData = new FormData();
																				const response = await fetch(
																					`/servers/${server?.id}?/retrievePassword`,
																					{
																						method: 'POST',
																						body: formData
																					}
																				);
																				const result = await response.json();
																				if (result.type === 'success' && result.data?.password) {
																					serverPassword = result.data.password; // Auto-fill the password field!
																					toastStore.success('Password retrieved and filled');
																				} else {
																					const msg =
																						result.data?.message || 'Failed to retrieve password';
																					toastStore.error(msg);
																					checkVpsError(msg);
																				}
																				isRetrievingPassword = false;
																			}}
																			disabled={isRetrievingPassword}
																			class="border-warning-border bg-warning-foreground/5 text-warning-foreground hover:bg-warning-foreground/10"
																		>
																			{#if isRetrievingPassword}
																				<Loader2 class="mr-2 size-3 animate-spin" />
																			{:else}
																				<RefreshCw class="mr-2 size-3" />
																			{/if}
																			Retrieve Password
																		</Button>
																	</div>
																</div>
															{/if}
														</div>
														{#if retrievedPassword}
															<div class="bg-background rounded border p-3">
																<div class="mb-2 flex items-center justify-between">
																	<p class="text-xs font-medium">Root Password:</p>
																	<Button
																		variant="ghost"
																		size="sm"
																		class="h-6 px-2"
																		onclick={() => {
																			navigator.clipboard.writeText(retrievedPassword);
																			toastStore.success('Password copied to clipboard');
																		}}
																	>
																		<Copy class="mr-1 size-3" />
																		Copy
																	</Button>
																</div>
																<code class="font-mono text-xs break-all">{retrievedPassword}</code>
															</div>
														{/if}
													</div>
												</div>
											</div>
										{/if}
									</div>
								</div>
							</Card.Content>
						</Card.Root>
					</section>

					<!-- Agent Section -->
					<section id="agent" class="space-y-4">
						<div class="space-y-1">
							<h2 class="text-xl font-bold tracking-tight">SelfHost Agent</h2>
							<p class="text-muted-foreground text-sm">
								The SelfHost Agent is a lightweight binary that establishes an outbound connection
								to our control plane. This allows for secure management behind NAT or firewalls,
								real-time log streaming, and automated health monitoring.
							</p>
						</div>
						<Card.Root>
							<Card.Header>
								<div class="flex items-center justify-between">
									<div>
										<Card.Title>SelfHost Agent</Card.Title>
										<Card.Description
											>Lightweight service for secure, outbound management.</Card.Description
										>
									</div>
									<div class="flex items-center gap-2">
										{#if server.connectionType === 'agent'}
											<Badge variant="outline" class="border-green-200 text-green-600">Active</Badge
											>
										{:else}
											<Badge variant="outline" class="text-muted-foreground">Inactive (SSH)</Badge>
										{/if}
									</div>
								</div>
							</Card.Header>
							<Card.Content class="space-y-6">
								<div class="bg-muted/30 rounded-lg border p-4 text-sm">
									<p class="mb-1 font-medium">How it works:</p>
									<p class="text-muted-foreground">
										The agent connects from your server to SelfHost over WebSockets. This eliminates
										the need for inbound SSH access after setup and provides real-time monitoring.
									</p>
								</div>

								<div class="bg-background rounded-lg border p-4">
									<div class="mb-6">
										<p class="text-sm font-medium">Remote Installation</p>
										<p class="text-muted-foreground mb-4 text-xs">
											{#if server.connectionType === 'agent'}
												Agent is currently managing this server.
											{:else}
												Deploy the Bun-based agent via SSH.
											{/if}
										</p>

										<div class="space-y-4">
											<div class="space-y-2">
												<div class="flex items-center justify-between">
													<Label for="callbackUrl">Callback URL Override (Optional)</Label>
													{#if dev}
														<Button
															variant="ghost"
															size="sm"
															class="text-primary hover:text-primary hover:bg-primary/10 h-6 text-[10px] font-bold uppercase"
															onclick={handleMagicTunnel}
															disabled={isStartingTunnel}
														>
															{#if isStartingTunnel}
																<RefreshCcw class="mr-1 size-3 animate-spin" />
																Starting...
															{:else}
																<Zap class="mr-1 size-3" />
																{data.tunnelUrl ? 'Regenerate Tunnel' : 'Develop with Magic Tunnel'}
															{/if}
														</Button>
													{/if}
												</div>
												{#if data.tunnelUrl}
													<p class="mb-1 font-mono text-[10px] text-green-500">
														Active Tunnel: {data.tunnelUrl}
													</p>
												{/if}
												<Input
													id="callbackUrl"
													placeholder="e.g., wss://random-words.trycloudflare.com"
													bind:value={callbackUrl}
													class="max-w-xl"
												/>
												<p class="text-muted-foreground text-xs">
													Useful for local development or Cloudflare Tunnels.
												</p>
											</div>
										</div>
									</div>

									{#if installProgress.length > 0}
										<div class="bg-muted/20 mb-6 space-y-3 rounded-lg border p-4">
											<div class="flex items-center justify-between border-b pb-2">
												<p class="text-sm font-semibold">Installation Progress</p>
												<Button
													variant="ghost"
													size="sm"
													onclick={() => (showInstallLogs = true)}
													class="h-6 text-xs"
												>
													<TerminalIcon class="mr-1 size-3" />
													View Logs
												</Button>
											</div>
											{#each installProgress as step}
												<div class="flex items-center gap-3 text-sm">
													{#if step.status === 'success'}
														<div
															class="flex size-5 items-center justify-center rounded-full border border-green-200 bg-green-500/10 text-[10px] font-bold text-green-600"
														>
															✓
														</div>
													{:else if step.status === 'in-progress'}
														<RefreshCcw class="text-primary size-4 animate-spin" />
													{:else if step.status === 'error'}
														<div
															class="bg-destructive/10 text-destructive border-destructive/20 flex size-5 items-center justify-center rounded-full border text-[10px] font-bold"
														>
															×
														</div>
													{:else}
														<div class="border-muted size-5 rounded-full border-2"></div>
													{/if}
													<span class={step.status === 'pending' ? 'text-muted-foreground' : ''}>
														{step.message}
													</span>
												</div>
											{/each}
										</div>

										<Dialog.Root bind:open={showInstallLogs}>
											<Dialog.Content class="max-w-3xl">
												<Dialog.Header>
													<Dialog.Title>Installation Logs</Dialog.Title>
													<Dialog.Description>
														Real-time output from the agent installation process.
													</Dialog.Description>
												</Dialog.Header>
												<div
													class="h-[400px] overflow-y-auto rounded-md bg-black p-4 font-mono text-xs whitespace-pre-wrap text-green-400"
													bind:this={logScrollContainer2}
												>
													{#if installLogs}
														{installLogs}
													{:else}
														<span class="text-muted-foreground opacity-50">Waiting for logs...</span
														>
													{/if}
												</div>
											</Dialog.Content>
										</Dialog.Root>
									{/if}

									<div class="grid grid-cols-1 gap-3">
										<div class="flex flex-col gap-2">
											<p
												class="text-muted-foreground mb-1 text-[10px] font-bold tracking-widest uppercase"
											>
												Agent Actions
											</p>
											<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
												<Button
													type="button"
													variant={server.connectionType === 'agent' ? 'outline' : 'default'}
													class="w-full"
													disabled={isInstallingAgent}
													onclick={handleInstallAgent}
												>
													{#if isInstallingAgent}
														<RefreshCcw class="mr-2 size-4 animate-spin" />
														Installing...
													{:else}
														<Zap class="mr-2 size-4" />
														{server.connectionType === 'agent'
															? 'Reinstall Agent'
															: 'Install Agent'}
													{/if}
												</Button>

												{#if server.connectionType === 'agent'}
													<Button
														type="button"
														variant="outline"
														class="w-full"
														disabled={isRestartingAgent}
														onclick={handleRestartAgent}
													>
														{#if isRestartingAgent}
															<RefreshCcw class="mr-2 size-4 animate-spin" />
															Restarting...
														{:else}
															<RotateCcw class="mr-2 size-4" />
															Restart Agent
														{/if}
													</Button>

													<Button
														type="button"
														variant="outline"
														class="w-full"
														onclick={() => (isDebugTerminalOpen = true)}
													>
														<TerminalIcon class="mr-2 size-4" />
														View Live Logs
													</Button>

													<Button
														type="button"
														variant="outline"
														class="w-full"
														disabled={isDiagnosing}
														onclick={handleDiagnose}
													>
														{#if isDiagnosing}
															<Activity class="mr-2 size-4 animate-pulse" />
															Running...
														{:else}
															<Activity class="mr-2 size-4" />
															Run diagnostics
														{/if}
													</Button>
												{/if}
											</div>
										</div>
									</div>
									{#if server.privateKeyId && server.connectionType !== 'agent'}
										<div class="mt-4 rounded-lg border border-amber-200 bg-amber-500/5 p-3">
											<p class="text-muted-foreground mb-2 text-xs">
												Agent not online? Run diagnostics to check the service and logs on the server (over SSH).
											</p>
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={isDiagnosing}
												onclick={handleDiagnose}
											>
												{#if isDiagnosing}
													<Activity class="mr-2 size-4 animate-pulse" />
													Running...
												{:else}
													<Activity class="mr-2 size-4" />
													Run diagnostics
												{/if}
											</Button>
										</div>
									{/if}

									{#if server.connectionType === 'agent'}
										<div class="mt-8 border-t pt-6">
											<h3
												class="text-muted-foreground mb-4 text-sm font-bold tracking-wider uppercase"
											>
												Agent Information
											</h3>
											<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
												<div class="bg-muted/30 border-border/50 rounded-xl border p-4">
													<p class="text-muted-foreground mb-1 text-xs font-semibold uppercase">
														Current Version
													</p>
													<div class="flex items-center gap-2">
														<p class="flex-1 truncate text-sm font-bold">
															v{server.agentVersion || '0.0.0'}
														</p>
														{#if server.agentChecksum === localAgentChecksum}
															<Badge
																variant="outline"
																class="h-5 border-green-200 bg-green-500/10 text-[9px] font-black text-green-600 uppercase"
																>Up to date</Badge
															>
														{:else if server.agentChecksum && localAgentChecksum}
															<Badge
																variant="outline"
																class="h-5 border-amber-200 bg-amber-500/10 text-[9px] font-black text-amber-600 uppercase"
																>Out of sync</Badge
															>
														{/if}
													</div>
													<p class="text-muted-foreground mt-2 truncate text-[9px]">
														Hash: <code class="text-[9px]">{server.agentChecksum || 'Unknown'}</code
														>
													</p>
													{#if server.agentChecksum !== localAgentChecksum && localAgentVersion}
														<p class="text-muted-foreground mt-1 text-[9px]">
															Latest build: <span class="font-bold">v{localAgentVersion}</span>
														</p>
													{/if}
												</div>
												<div class="bg-muted/30 border-border/50 rounded-xl border p-4">
													<p class="text-muted-foreground mb-1 text-xs font-semibold uppercase">
														Time Installed
													</p>
													<p class="text-sm font-bold">
														{server.agentInstalledAt
															? new Date(server.agentInstalledAt).toLocaleString()
															: 'N/A'}
													</p>
													{#if server.agentInstalledAt}
														<p class="text-muted-foreground mt-1 text-[9px]">
															{Math.floor(
																(Date.now() - new Date(server.agentInstalledAt).getTime()) /
																	(1000 * 60 * 60 * 24)
															)} days ago
														</p>
													{/if}
												</div>
											</div>
										</div>
									{/if}
								</div>

								{#if server.agentKey}
									<div class="space-y-2">
										<Label>Agent Secret Key</Label>
										<div class="flex max-w-xl gap-2">
											<Input value={server.agentKey} readonly type="password" />
											<Button
												variant="outline"
												size="icon"
												onclick={() => {
													navigator.clipboard.writeText(server?.agentKey || '');
													toastStore.success('Key copied to clipboard');
												}}
											>
												<Save class="size-4" />
											</Button>
										</div>
										<p class="text-muted-foreground text-xs">
											This key is used by the agent to authenticate. Keep it secret.
										</p>
									</div>
								{/if}

								{#if showDiagnostics}
									<div class="space-y-2">
										<div class="flex items-center justify-between">
											<Label>Live Diagnostics</Label>
											<Button variant="ghost" size="sm" onclick={() => (showDiagnostics = false)}>
												<X class="size-4" />
											</Button>
										</div>
										<div
											class="bg-muted/20 max-h-96 overflow-x-auto overflow-y-auto rounded-lg border p-4 font-mono text-xs"
										>
											<pre class="whitespace-pre-wrap">{diagnosticsOutput}</pre>
										</div>
									</div>
								{/if}
							</Card.Content>
						</Card.Root>
					</section>

					<!-- Proxy Section -->
					<section id="proxy" class="space-y-4">
						<div class="space-y-1">
							<h2 class="text-xl font-bold tracking-tight">Network Proxy</h2>
							<p class="text-muted-foreground text-sm">
								Your gateway to the web. Deploy and configure a high-performance edge proxy like
								Traefik or Caddy. SelfHost handles the complexity of SSL certificate lifecycle
								management and automated routing discovery for your apps.
							</p>
						</div>
						<div class="grid gap-6 md:grid-cols-3">
							<Card.Root class="md:col-span-2">
								<Card.Header>
									<Card.Title>Proxy Configuration</Card.Title>
									<Card.Description>Manage the edge proxy for your applications.</Card.Description>
								</Card.Header>
								<Card.Content class="space-y-6">
									<div class="space-y-4">
										<div class="flex items-center gap-6">
											<div class="w-full max-w-xs space-y-2">
												<Label>Proxy Type</Label>
												<select
													class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
													bind:value={proxyType}
												>
													<option value="none">None</option>
													<option value="traefik">Traefik (Recommended)</option>
													<option value="caddy">Caddy</option>
												</select>
											</div>
											<div class="flex items-end gap-2">
												{#if proxyStatus === 'running'}
													<Button
														variant="outline"
														class="text-destructive border-destructive/20 hover:bg-destructive/10"
														onclick={() => handleProxyAction('stop')}
														disabled={isProxyActionLoading}
													>
														<Square class="mr-2 size-4" /> Stop
													</Button>
													<Button
														variant="outline"
														onclick={() => handleProxyAction('restart')}
														disabled={isProxyActionLoading}
													>
														<RefreshCcw class="mr-2 size-4" /> Restart
													</Button>
												{:else if proxyStatus === 'stopped' || proxyStatus === 'error'}
													<Button
														class="bg-primary hover:bg-primary/90"
														onclick={() => handleProxyAction('start')}
														disabled={isProxyActionLoading || proxyType === 'none'}
													>
														{#if isProxyActionLoading}
															<Loader2 class="mr-2 size-4 animate-spin" />
														{:else}
															<Play class="mr-2 size-4" />
														{/if}
														Start Proxy
													</Button>
												{:else}
													<Button disabled variant="outline">
														<Loader2 class="mr-2 size-4 animate-spin" />
														{proxyStatus}...
													</Button>
												{/if}
											</div>
										</div>

										{#if isDeployingProxy && proxyProgress.length > 0}
											<div class="bg-muted/30 space-y-2 rounded-lg border p-4">
												<div
													class="text-muted-foreground mb-3 text-xs font-bold tracking-wider uppercase"
												>
													Deployment Progress
												</div>
												{#each proxyProgress as step}
													<div class="flex items-center gap-3 text-sm">
														{#if step.status === 'success'}
															<div
																class="flex size-5 shrink-0 items-center justify-center rounded-full bg-green-500/20"
															>
																<div class="size-2 rounded-full bg-green-500"></div>
															</div>
														{:else if step.status === 'in-progress'}
															<Loader2 class="text-primary size-5 shrink-0 animate-spin" />
														{:else if step.status === 'error'}
															<div
																class="bg-destructive/20 flex size-5 shrink-0 items-center justify-center rounded-full"
															>
																<X class="text-destructive size-3" />
															</div>
														{:else}
															<div
																class="bg-muted flex size-5 shrink-0 items-center justify-center rounded-full"
															>
																<div class="bg-muted-foreground/30 size-2 rounded-full"></div>
															</div>
														{/if}
														<span
															class:text-muted-foreground={step.status === 'pending'}
															class:text-green-600={step.status === 'success'}
															class:text-destructive={step.status === 'error'}
														>
															{step.message}
														</span>
													</div>
												{/each}
											</div>
										{/if}

										{#if proxyType === 'traefik'}
											<div class="bg-primary/5 border-primary/10 space-y-3 rounded-lg border p-4">
												<div class="text-primary flex items-center gap-2">
													<ShieldCheck class="size-5" />
													<span class="text-sm font-bold tracking-wider uppercase"
														>Traefik v3.6 Optimized</span
													>
												</div>
												<p class="text-muted-foreground text-xs leading-relaxed">
													SelfHost provisions a hardened Traefik instance with <strong
														>Let's Encrypt Wildcard</strong
													>
													support,
													<strong>HTTP/3 (QUIC)</strong> enabled, and automatic Docker service discovery.
												</p>
												<div class="grid grid-cols-2 gap-4 pt-2">
													<div class="text-muted-foreground text-[10px]">
														<div class="text-foreground font-bold">PORTS</div>
														80, 443, 8080
													</div>
													<div class="text-muted-foreground text-[10px]">
														<div class="text-foreground font-bold">NETWORK</div>
														premo (external)
													</div>
												</div>
											</div>
										{/if}
									</div>
								</Card.Content>
							</Card.Root>

							<div class="space-y-6">
								<Card.Root>
									<Card.Header>
										<Card.Title class="text-sm">Status</Card.Title>
									</Card.Header>
									<Card.Content>
										<div class="flex flex-col items-center justify-center space-y-4 py-4">
											<div class="relative">
												<div
													class="bg-primary/20 absolute inset-0 scale-150 animate-pulse rounded-full blur-xl"
												></div>
												<div
													class="bg-muted relative flex size-16 items-center justify-center rounded-2xl border"
												>
													<Network
														class="size-8 {proxyStatus === 'running'
															? 'text-primary'
															: 'text-muted-foreground'}"
													/>
												</div>
											</div>
											<div class="text-center">
												<div class="text-xl font-bold capitalize">{proxyStatus}</div>
												<div class="text-muted-foreground text-xs">
													Last update: {server.proxyLastAppliedAt
														? new Date(server.proxyLastAppliedAt).toLocaleString()
														: 'Never'}
												</div>
											</div>
										</div>
									</Card.Content>
								</Card.Root>

								<Card.Root>
									<Card.Header>
										<Card.Title class="text-sm">Quick Metrics</Card.Title>
									</Card.Header>
									<Card.Content class="space-y-4">
										<div class="space-y-1">
											<div class="text-muted-foreground flex justify-between text-[10px] uppercase">
												<span>Active Routes</span>
												<span>0</span>
											</div>
											<div class="bg-muted h-1 rounded-full"></div>
										</div>
										<div class="space-y-1">
											<div class="text-muted-foreground flex justify-between text-[10px] uppercase">
												<span>SSL Certs</span>
												<span>0</span>
											</div>
											<div class="bg-muted h-1 rounded-full"></div>
										</div>
									</Card.Content>
								</Card.Root>
							</div>
						</div>
					</section>

					<!-- Danger Zone Section -->
					<section id="danger-zone" class="space-y-4">
						<div class="space-y-1">
							<h2 class="text-xl font-bold tracking-tight">Danger Zone</h2>
							<p class="text-muted-foreground text-sm">
								High-impact administrative actions. These operations can result in permanent data
								loss or disconnect the server from the SelfHost management platform. Proceed only if
								fully certain.
							</p>
						</div>
						<Card.Root class="border-destructive/20 bg-destructive/5">
							<Card.Header>
								<Card.Title class="text-destructive">Server Removal</Card.Title>
								<Card.Description>Irreversible actions for this server.</Card.Description>
							</Card.Header>
							<Card.Content>
								<div
									class="bg-background border-destructive/20 flex items-center justify-between rounded-lg border p-4"
								>
									<div class="space-y-1">
										<p class="text-sm font-medium">Remove Server</p>
										<p class="text-muted-foreground text-xs">
											Disconnect and remove all metadata. Apps will remain on server but no longer
											managed.
										</p>
									</div>
									<Button variant="destructive" onclick={() => (showDeleteDialog = true)}
										>Remove</Button
									>
								</div>
							</Card.Content>
						</Card.Root>
					</section>
				</div>

				<!-- On This Page Sidebar -->
				<aside class="hidden lg:block">
					<div class="sticky top-24 space-y-4">
						<div class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
							On This Page
						</div>
						<nav class="flex flex-col space-y-3 border-l text-sm">
							{#if server.vpsProviderId}
								<a
									href="#cloud-connection"
									class="hover:text-primary border-l-2 border-transparent pl-4 transition-colors"
									>Cloud Connection</a
								>
							{/if}
							<a
								href="#configuration"
								class="hover:text-primary border-l-2 border-transparent pl-4 transition-colors"
								>Configuration</a
							>
							<a
								href="#agent"
								class="hover:text-primary border-l-2 border-transparent pl-4 transition-colors"
								>SelfHost Agent</a
							>
							<a
								href="#proxy"
								class="hover:text-primary border-l-2 border-transparent pl-4 transition-colors"
								>Network Proxy</a
							>
							<a
								href="#danger-zone"
								class="hover:text-primary border-l-2 border-transparent pl-4 transition-colors"
								>Danger Zone</a
							>
						</nav>

						<div class="pt-8">
							<div class="bg-primary/5 border-primary/10 rounded-xl border p-4">
								<div class="text-primary flex items-center gap-2 text-xs font-bold uppercase">
									<Zap class="size-3" />
									Pro Tip
								</div>
								<p class="text-muted-foreground mt-2 text-xs leading-relaxed">
									Use the <span class="font-bold">Terminal</span> button in the header to quickly access
									your server's shell without leaving the dashboard.
								</p>
							</div>
						</div>
					</div>
				</aside>
			</Tabs.Content>

			<Tabs.Content value="quickdeploy">
				<Card.Root>
					<Card.Header>
						<Card.Title>Quick Deploy Test App</Card.Title>
						<Card.Description
							>Deploy a simple Bun application with Firejail sandboxing to test your server setup.</Card.Description
						>
					</Card.Header>
					<Card.Content class="space-y-6">
						<div class="bg-primary/5 border-primary/10 space-y-2 rounded-lg border p-4">
							<div class="text-primary flex items-center gap-2 font-medium">
								<Zap class="size-4" />
								<span>What gets deployed?</span>
							</div>
							<p class="text-muted-foreground text-sm">
								A lightweight "Hello World" web server running on <strong>Bun</strong> (ultra-fast
								JavaScript runtime), isolated with <strong>Firejail</strong> for security, and
								automatically configured with <strong>Traefik</strong>
								for HTTPS routing.
							</p>
						</div>

						<!-- Readiness Check Section -->
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<Label>Server Readiness</Label>
								<Button
									variant="outline"
									size="sm"
									onclick={handleCheckReadiness}
									disabled={isCheckingReadiness || server?.connectionType !== 'agent'}
								>
									{#if isCheckingReadiness}
										<Loader2 class="mr-2 size-4 animate-spin" />
										Checking...
									{:else}
										<RefreshCcw class="mr-2 size-4" />
										Check Server
									{/if}
								</Button>
							</div>

							{#if readinessChecks.length > 0}
								<div
									class="space-y-2 rounded-lg border p-4 {serverReady
										? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20'
										: 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/20'}"
								>
									<div
										class="flex items-center gap-2 font-medium {serverReady
											? 'text-green-700 dark:text-green-300'
											: 'text-yellow-700 dark:text-yellow-300'}"
									>
										{#if serverReady}
											<CircleCheck class="size-4" />
											<span>Server is ready!</span>
										{:else}
											<CircleAlert class="size-4" />
											<span>Configuration needed</span>
										{/if}
									</div>
									<div class="mt-3 space-y-1.5">
										{#each readinessChecks as check}
											<div class="flex items-center gap-2 text-sm">
												{#if check.status === 'running' || check.status === 'installed' || check.status === 'available'}
													<div
														class="flex size-4 shrink-0 items-center justify-center rounded-full bg-green-500"
													>
														<div class="size-1.5 rounded-full bg-white"></div>
													</div>
												{:else}
													<div
														class="flex size-4 shrink-0 items-center justify-center rounded-full bg-yellow-500"
													>
														<div class="size-1.5 rounded-full bg-white"></div>
													</div>
												{/if}
												<span class="text-muted-foreground">
													{check.name}:
													<strong
														class={check.status === 'running' ||
														check.status === 'installed' ||
														check.status === 'available'
															? 'text-green-600 dark:text-green-400'
															: 'text-yellow-600 dark:text-yellow-400'}>{check.message}</strong
													>
												</span>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>

						<div class="space-y-4">
							<div class="space-y-2">
								<Label for="app-name">Application Name</Label>
								<Input
									id="app-name"
									bind:value={appName}
									placeholder="hello-world"
									disabled={isDeployingApp}
									class="max-w-xl"
								/>
								<p class="text-muted-foreground text-xs">
									Used for systemd service and internal routing
								</p>
							</div>

							<div class="space-y-2">
								<Label for="domain-select">Domain / Hostname</Label>
								{#if data.availableDomains && data.availableDomains.length > 0}
									<select
										id="domain-select"
										class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full max-w-xl rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
										bind:value={selectedDomain}
										disabled={isDeployingApp}
									>
										<option value="">Select a domain...</option>
										{#each data.availableDomains as domain}
											{#if domain.recordName}
												{@const fullDomain =
													domain.recordName === '@'
														? domain.domain
														: `${domain.recordName}.${domain.domain}`}
												<option value={fullDomain}>
													{fullDomain}
													{#if domain.syncMode === 'tag'}
														(tag: {domain.syncTag})
													{:else if domain.syncMode === 'server'}
														(server-specific)
													{:else}
														(static IP)
													{/if}
												</option>
											{/if}
										{/each}
									</select>
									<p class="text-muted-foreground text-xs">
										Showing domains synced to this server via tags, server assignment, or static IP
										match
									</p>
								{:else}
									<div class="bg-muted/30 rounded-lg border p-4">
										<p class="text-muted-foreground text-sm">
											No domains found pointing to this server.
											<a href="/domains" class="text-primary hover:underline">Add a domain</a> with
											an A record pointing to <strong>{server.ip}</strong>.
										</p>
									</div>
								{/if}
							</div>

							<Button
								class="w-full"
								disabled={!selectedDomain ||
									!appName ||
									isDeployingApp ||
									server.connectionType !== 'agent'}
								onclick={handleDeployApp}
							>
								{#if isDeployingApp}
									<Loader2 class="mr-2 size-4 animate-spin" />
									Deploying...
								{:else}
									<Play class="mr-2 size-4" />
									Deploy Test App
								{/if}
							</Button>

							{#if isDeployingApp && deployProgress.length > 0}
								<div class="bg-muted/30 space-y-2 rounded-lg border p-4">
									<div
										class="text-muted-foreground mb-3 text-xs font-bold tracking-wider uppercase"
									>
										Deployment Progress
									</div>
									{#each deployProgress as step}
										<div class="flex items-center gap-3 text-sm">
											{#if step.status === 'success'}
												<div
													class="flex size-5 shrink-0 items-center justify-center rounded-full bg-green-500/20"
												>
													<div class="size-2 rounded-full bg-green-500"></div>
												</div>
											{:else if step.status === 'in-progress'}
												<Loader2 class="text-primary size-5 shrink-0 animate-spin" />
											{:else if step.status === 'error'}
												<div
													class="bg-destructive/20 flex size-5 shrink-0 items-center justify-center rounded-full"
												>
													<X class="text-destructive size-3" />
												</div>
											{:else}
												<div
													class="bg-muted flex size-5 shrink-0 items-center justify-center rounded-full"
												>
													<div class="bg-muted-foreground/30 size-2 rounded-full"></div>
												</div>
											{/if}
											<span
												class:text-muted-foreground={step.status === 'pending'}
												class:text-green-600={step.status === 'success'}
												class:text-destructive={step.status === 'error'}
											>
												{step.message}
											</span>
										</div>
									{/each}
								</div>
							{/if}

							{#if server.connectionType !== 'agent'}
								<div
									class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/20"
								>
									<p class="text-sm text-yellow-800 dark:text-yellow-200">
										⚠️ This server needs the SelfHost Agent installed to use Quick Deploy. Go to the <strong
											>Agent</strong
										> tab to install it.
									</p>
								</div>
							{/if}
						</div>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<Tabs.Content value="apps">
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div class="space-y-1">
							<h2 class="text-lg font-semibold">Deployed Applications</h2>
							<p class="text-muted-foreground text-sm">
								Manage applications deployed via Quick Deploy on this server.
							</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							onclick={async () => {
								await invalidateAll();
								data.deployedApps?.forEach((app) => checkAppStatus(app.name));
							}}
						>
							<RefreshCw class="mr-2 size-4" />
							Refresh
						</Button>
					</div>

					{#if data.deployedApps && data.deployedApps.length > 0}
						<Card.Root>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Status</TableHead>
										<TableHead>Application</TableHead>
										<TableHead>Domain</TableHead>
										<TableHead>Port</TableHead>
										<TableHead>Deployed</TableHead>
										<TableHead class="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{#each data.deployedApps as app}
										<TableRow>
											<TableCell>
												<Badge
													variant="outline"
													class="flex w-fit items-center gap-2 {(appStatuses[app.name] ||
														app.status) === 'running'
														? 'border-green-200 bg-green-50 text-green-600'
														: 'border-yellow-200 bg-yellow-50 text-yellow-600'}"
												>
													<div
														class="size-1.5 rounded-full {(appStatuses[app.name] || app.status) ===
														'running'
															? 'animate-pulse bg-green-500'
															: 'bg-yellow-500'}"
													></div>
													{appStatuses[app.name] || app.status}
													{#if isCheckingAppStatus[app.name]}
														<Loader2 class="size-3 animate-spin" />
													{/if}
												</Badge>
											</TableCell>
											<TableCell class="font-semibold">
												<div class="flex items-center gap-2">
													<Box class="text-muted-foreground size-4" />
													{app.name}
												</div>
											</TableCell>
											<TableCell>
												<a
													href={`https://${app.domain}`}
													target="_blank"
													class="text-primary flex items-center gap-1 text-sm hover:underline"
												>
													{app.domain}
													<ExternalLink class="size-3" />
												</a>
											</TableCell>
											<TableCell>
												<code class="bg-muted rounded px-1.5 py-0.5 text-xs">{app.port}</code>
											</TableCell>
											<TableCell class="text-muted-foreground text-xs">
												{new Date(app.deployedAt).toLocaleDateString()}
											</TableCell>
											<TableCell class="text-right">
												<div class="flex items-center justify-end gap-1">
													<Button
														variant="ghost"
														size="icon"
														title="Diagnostics"
														onclick={async () => {
															try {
																const response = await getAppDiagnosticsRemote({
																	serverId: server.id,
																	appName: app.name
																});
																if (response.success) {
																	toastStore.success(response.message || 'Diagnostics started');
																} else {
																	toastStore.error(response.message || 'Failed to run diagnostics');
																}
															} catch (err) {
																toastStore.error('Failed to run diagnostics');
															}
														}}
													>
														<Activity class="size-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														title="Restart"
														onclick={() => {
															toastStore.success('Restart command sent');
														}}
													>
														<RotateCcw class="size-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														class="text-destructive hover:text-destructive hover:bg-destructive/10"
														title="Delete"
														onclick={async () => {
															if (
																!confirm(
																	`Are you sure you want to delete ${app.name}? This cannot be undone.`
																)
															)
																return;
															try {
																const response = await deleteAppRemote({
																	serverId: server.id,
																	appName: app.name
																});
																if (response.success) {
																	toastStore.success(
																		response.message || 'Application deleted successfully'
																	);
																	await invalidateAll();
																} else {
																	toastStore.error(
																		response.message || 'Failed to delete application'
																	);
																}
															} catch (err) {
																toastStore.error(
																	'An error occurred while deleting the application'
																);
															}
														}}
													>
														<Trash2 class="size-4" />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									{/each}
								</TableBody>
							</Table>
						</Card.Root>
					{:else}
						<div
							class="bg-muted/10 flex flex-col items-center justify-center rounded-lg border p-8 text-center"
						>
							<div class="bg-primary/10 mb-4 rounded-full p-3">
								<Box class="text-primary size-6" />
							</div>
							<h3 class="mb-2 text-lg font-semibold">No apps deployed yet</h3>
							<p class="text-muted-foreground mb-6 max-w-sm">
								Use the Quick Deploy tab to deploy your first application to this server.
							</p>
							<Button
								onclick={() =>
									(document.querySelector('[value="quickdeploy"]') as HTMLElement)?.click()}
							>
								Go to Quick Deploy
							</Button>
						</div>
					{/if}
				</div>
			</Tabs.Content>
			{#if server.vpsProviderId && server.providerName === 'Vultr'}
				<Tabs.Content value="advanced" class="space-y-6">
					<div class="space-y-4">
						<div class="space-y-1">
							<h2 class="text-xl font-bold tracking-tight">Advanced Settings</h2>
							<p class="text-muted-foreground text-sm">
								Manage reverse DNS (PTR) records for IPv4 and IPv6 addresses on Vultr-managed
								servers.
							</p>
						</div>

						<Card.Root>
							<Card.Header>
								<Card.Title>Reverse DNS (PTR) Records</Card.Title>
								<Card.Description>
									Set reverse DNS records for your server's IP addresses. This helps with email
									deliverability and server identification.
								</Card.Description>
							</Card.Header>
							<Card.Content class="space-y-6">
								<!-- IPv4 Reverse DNS -->
								<div class="space-y-4">
									<div class="space-y-2">
										<h3 class="text-sm font-semibold">IPv4 Addresses</h3>
										{#if reverseDnsData.ipv4s && reverseDnsData.ipv4s.length > 0}
											<div class="space-y-3">
												{#each reverseDnsData.ipv4s as ipv4}
													<div class="flex items-start gap-4 rounded-lg border p-4">
														<div class="flex-1 space-y-2">
															<div class="flex items-center gap-2">
																<Label class="font-mono text-sm">{ipv4.ip}</Label>
																{#if ipv4.reverse}
																	<Badge variant="outline" class="text-xs">
																		{ipv4.reverse}
																	</Badge>
																{/if}
															</div>
															<Input
																placeholder="e.g., mail.example.com"
																value={ipv4.reverse || ''}
																oninput={(e) => {
																	ipv4.reverse = e.currentTarget.value;
																	reverseDnsData.ipv4s = [...reverseDnsData.ipv4s];
																}}
															/>
														</div>
														<Button
															size="sm"
															onclick={() =>
																handleUpdateReverseDns('ipv4', ipv4.ip, ipv4.reverse || '')}
															disabled={isUpdatingReverseDns}
														>
															{#if isUpdatingReverseDns}
																<Loader2 class="mr-2 size-4 animate-spin" />
															{:else}
																<Save class="mr-2 size-4" />
															{/if}
															Update
														</Button>
													</div>
												{/each}
											</div>
										{:else if isLoadingReverseDns}
											<div class="flex items-center justify-center py-8">
												<Loader2 class="text-muted-foreground size-6 animate-spin" />
											</div>
										{:else}
											<p class="text-muted-foreground text-sm">No IPv4 addresses found</p>
										{/if}
									</div>
								</div>

								<!-- IPv6 Reverse DNS -->
								<div class="space-y-4">
									<div class="space-y-2">
										<h3 class="text-sm font-semibold">IPv6 Addresses</h3>
										{#if reverseDnsData.ipv6s && reverseDnsData.ipv6s.length > 0}
											<div class="space-y-3">
												{#each reverseDnsData.ipv6s as ipv6}
													<div class="flex items-start gap-4 rounded-lg border p-4">
														<div class="flex-1 space-y-2">
															<div class="flex items-center gap-2">
																<Label class="font-mono text-xs">{ipv6.ip}</Label>
																{#if ipv6.reverse}
																	<Badge variant="outline" class="text-xs">
																		{ipv6.reverse}
																	</Badge>
																{/if}
															</div>
															<Input
																placeholder="e.g., mail.example.com"
																value={ipv6.reverse || ''}
																oninput={(e) => {
																	ipv6.reverse = e.currentTarget.value;
																	reverseDnsData.ipv6s = [...reverseDnsData.ipv6s];
																}}
															/>
														</div>
														<Button
															size="sm"
															onclick={() =>
																handleUpdateReverseDns('ipv6', ipv6.ip, ipv6.reverse || '')}
															disabled={isUpdatingReverseDns}
														>
															{#if isUpdatingReverseDns}
																<Loader2 class="mr-2 size-4 animate-spin" />
															{:else}
																<Save class="mr-2 size-4" />
															{/if}
															Update
														</Button>
													</div>
												{/each}
											</div>
										{:else if isLoadingReverseDns}
											<div class="flex items-center justify-center py-8">
												<Loader2 class="text-muted-foreground size-6 animate-spin" />
											</div>
										{:else}
											<p class="text-muted-foreground text-sm">No IPv6 addresses found</p>
										{/if}
									</div>
								</div>

								<div class="flex justify-end">
									<Button
										variant="outline"
										onclick={handleRefreshReverseDns}
										disabled={isLoadingReverseDns}
									>
										{#if isLoadingReverseDns}
											<Loader2 class="mr-2 size-4 animate-spin" />
										{:else}
											<RefreshCcw class="mr-2 size-4" />
										{/if}
										Refresh
									</Button>
								</div>
							</Card.Content>
						</Card.Root>
					</div>
				</Tabs.Content>
			{/if}
		</Tabs.Root>
	</div>

	<Dialog.Root open={isKeyManagerOpen} onOpenChange={(open) => !open && closeKeyManager()}>
		<Dialog.Content class="sm:max-w-[500px]">
			<Dialog.Header>
				<Dialog.Title>Key Management</Dialog.Title>
				<Dialog.Description>Manage SSH deployment keys for your infrastructure.</Dialog.Description>
			</Dialog.Header>

			<div class="space-y-6 py-4">
				<div class="grid gap-3">
					<div class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
						Available Keys
					</div>
					{#each data.privateKeys as key}
						<div
							class="bg-muted/30 hover:bg-muted/50 flex items-center justify-between rounded-xl border p-3 transition-colors"
						>
							<div class="flex items-center gap-3">
								<div class="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
									<Key class="text-primary size-4" />
								</div>
								<div class="min-w-0">
									<div class="truncate text-sm font-bold">{key.name}</div>
									<div class="text-muted-foreground truncate text-[10px]">
										{key.description || 'No description'}
									</div>
								</div>
							</div>
							<Button
								variant={server.privateKeyId === key.id ? 'secondary' : 'ghost'}
								size="sm"
								class="h-7 text-xs"
								onclick={() => {
									server.privateKeyId = key.id;
									closeKeyManager();
									toastStore.success(`${key.name} selected`);
								}}
							>
								{server.privateKeyId === key.id ? 'Selected' : 'Select'}
							</Button>
						</div>
					{/each}
				</div>

				<div class="bg-border/50 h-px w-full"></div>

				<div class="space-y-2">
					<div class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
						Enroll New Key
					</div>
					<AddKeyForm
						defaultName={server.name}
						onSuccess={async (newKey) => {
							closeKeyManager();
							// Refresh data to get new key in list
							await invalidateAll();
							server.privateKeyId = newKey.id;
							toastStore.success('Key enrolled and selected');
						}}
					/>
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Root>

	<Dialog.Root bind:open={showDeleteDialog}>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>Are you absolutely sure?</Dialog.Title>
				<Dialog.Description>
					This will remove <strong>{server.name}</strong> from SelfHost. You will need to manually reconnect
					it later if needed.
				</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer>
				<Button variant="destructive" class="w-full" onclick={handleDelete}>Remove Server</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>

	<Dialog.Root bind:open={isRebootDialogOpen}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<div
					class="bg-muted/30 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border"
				>
					{#if selectedRebootType === 'intelligent'}
						<Zap class="size-6 text-yellow-500" />
					{:else if selectedRebootType === 'graceful'}
						<RefreshCw class="size-6 text-blue-500" />
					{:else}
						<ShieldAlert class="text-destructive size-6" />
					{/if}
				</div>
				<Dialog.Title class="text-2xl font-bold tracking-tight">
					Confirm {selectedRebootType} Restart
				</Dialog.Title>
				<Dialog.Description class="pt-2 text-base leading-relaxed">
					{#if selectedRebootType === 'intelligent'}
						This will handle traffic management and ensure availability of services across the
						network, managing DNS and waiting until the TTL is lapsed for a safe restart to avoid
						down time.
					{:else if selectedRebootType === 'graceful'}
						Immediate graceful restart without advanced traffic management or DNS TTL handling.
					{:else if selectedRebootType === 'hard'}
						Forced restart executed upstream with the cloud provider. Use only if the server is
						unresponsive.
					{/if}
				</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer class="mt-6 gap-2 sm:gap-0">
				<Button variant="ghost" onclick={() => (isRebootDialogOpen = false)} class="font-semibold"
					>Cancel</Button
				>
				<Button
					variant={selectedRebootType === 'hard' ? 'destructive' : 'default'}
					onclick={handleRebootServer}
					class="px-8 font-bold"
				>
					Restart Server
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>

	<Dialog.Root bind:open={isTerminalOpen}>
		<Dialog.Content class="h-[80vh] min-w-[800px] overflow-hidden border-0 p-0">
			<div class="h-full w-full bg-black p-2 text-white">
				<Terminal
					serverName={server.name}
					serverIp={server.ip}
					serverId={server.id}
					onClose={() => (isTerminalOpen = false)}
				/>
			</div>
		</Dialog.Content>
	</Dialog.Root>

	<Dialog.Root bind:open={isDebugTerminalOpen}>
		<Dialog.Content class="flex h-[80vh] min-w-[800px] flex-col">
			<Dialog.Header>
				<Dialog.Title>Agent Logs</Dialog.Title>
				<Dialog.Description>
					Viewing recent logs from <code>/var/log/selfhost-agent.log</code>
				</Dialog.Description>
			</Dialog.Header>
			<div
				bind:this={logScrollContainer}
				class="mt-2 min-h-0 flex-1 overflow-auto scroll-smooth rounded-md border bg-zinc-950 p-4 font-mono text-xs text-zinc-300 shadow-inner"
			>
				{#if debugLogs}
					<pre class="whitespace-pre-wrap">{debugLogs}</pre>
					<div class="h-4"></div>
					<!-- Spacer to allow scrolling past last line -->
				{:else}
					<div class="text-muted-foreground flex h-full items-center justify-center gap-2">
						{#if logEventSource}
							{#if hasConnected}
								<div class="animate-in fade-in text-center duration-500">
									<Activity class="text-primary mx-auto mb-4 size-8 animate-pulse opacity-20" />
									<p class="font-medium">Connected to server.</p>
									<p class="text-xs opacity-50">Waiting for log output...</p>
								</div>
							{:else}
								<div class="animate-in fade-in scale-95 text-center duration-500">
									<Loader2 class="text-primary mx-auto mb-4 size-8 animate-spin opacity-50" />
									<p class="font-medium">Initiating SSH Tunnel...</p>
									<p class="text-xs opacity-50">This may take a few seconds.</p>
								</div>
							{/if}
						{:else}
							<div class="text-center">
								<CircleAlert class="mx-auto mb-4 size-8 opacity-20" />
								<p>No logs available.</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>
			<Dialog.Footer>
				<Button
					variant="outline"
					onclick={() => {
						navigator.clipboard.writeText(debugLogs);
						toastStore.success('Logs copied to clipboard');
					}}
					disabled={!debugLogs}
				>
					<Copy class="mr-2 size-4" />
					Copy
				</Button>
				<Button
					variant="outline"
					onclick={() => {
						stopLogStream();
						startLogStream();
					}}
				>
					<RefreshCw class="mr-2 size-4" />
					Reload Stream
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>

	<Sheet.Root bind:open={showVpsUpdateSheet}>
		<Sheet.Content side="bottom" class="h-[400px]">
			<Sheet.Header>
				<Sheet.Title class="flex items-center gap-2">
					<ShieldAlert class="text-warning-muted size-5" />
					Update Cloud Provider API Key
				</Sheet.Title>
				<Sheet.Description>
					Your cloud provider reported an authorization error. This usually means the API key is
					expired or has been deactivated. Please provide a new API key to continue managing this
					server.
				</Sheet.Description>
			</Sheet.Header>

			<div class="mx-auto mt-8 max-w-2xl space-y-6">
				<div class="space-y-2">
					<Label for="newVpsApiKey" class="text-sm font-semibold"
						>New API Key for {server.vpsProviderId ? 'your provider' : 'Cloud Provider'}</Label
					>
					<div class="flex gap-3">
						<Input
							id="newVpsApiKey"
							type="password"
							bind:value={newVpsApiKey}
							placeholder="Enter your new API key..."
							class="bg-muted/50 flex-1"
						/>
						<Button
							onclick={handleUpdateVpsKey}
							disabled={isUpdatingVpsKey || !newVpsApiKey}
							class="min-w-[140px]"
						>
							{#if isUpdatingVpsKey}
								<Loader2 class="mr-2 size-4 animate-spin" />
								Verifying...
							{:else}
								<CheckCircle2 class="mr-2 size-4" />
								Test & Update
							{/if}
						</Button>
					</div>
					<p class="text-muted-foreground text-xs">
						We will verify the key with the provider before saving it.
					</p>
				</div>

				<div class="border-warning-border bg-warning rounded-lg border p-4">
					<div class="flex items-start gap-3">
						<AlertCircle class="text-warning-muted mt-0.5 size-4" />
						<div class="text-warning-foreground text-sm">
							<p class="font-semibold">Important</p>
							<p class="opacity-80">
								Updating this key will affect all servers and domains associated with this provider
								account in SelfHost.
							</p>
						</div>
					</div>
				</div>
			</div>

			<Sheet.Footer class="mt-8">
				<Sheet.Close onclick={() => (showVpsUpdateSheet = false)}>
					<Button variant="ghost">Cancel</Button>
				</Sheet.Close>
			</Sheet.Footer>
		</Sheet.Content>
	</Sheet.Root>
{:else}
	<div class="flex min-h-[400px] items-center justify-center">
		<div class="text-muted-foreground">Server not found.</div>
	</div>
{/if}
