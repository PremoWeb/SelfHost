<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { Maximize2, X } from 'lucide-svelte';

	let container: HTMLDivElement | null = $state(null);
	let isFullscreen = $state(false);
	let fullscreenOverlay: HTMLDivElement | null = $state(null);

	function openFullscreen() {
		if (!browser) return;
		isFullscreen = true;
	}

	function closeFullscreen() {
		isFullscreen = false;
	}

	onMount(() => {
		if (!browser) return;
		
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isFullscreen) {
				closeFullscreen();
			}
		};
		
		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	});
</script>

<div bind:this={container} class="agent-architecture-diagram relative my-12">
	<div class="diagram-container rounded-lg border-2 border-border bg-muted/30 p-8 overflow-x-auto">
		<svg
			viewBox="0 0 1400 1000"
			class="w-full h-auto"
			preserveAspectRatio="xMidYMid meet"
		>
			<defs>
				<linearGradient id="controlPanelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
					<stop offset="100%" style="stop-color:#2563eb;stop-opacity:1" />
				</linearGradient>
				<linearGradient id="serverGrad" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
					<stop offset="100%" style="stop-color:#d97706;stop-opacity:1" />
				</linearGradient>
				<linearGradient id="agentGrad" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
					<stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
				</linearGradient>
				<marker id="arrowRight" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto">
					<polygon points="0 0, 12 6, 0 12" fill="#475569" />
				</marker>
				<marker id="arrowLeft" markerWidth="12" markerHeight="12" refX="1" refY="6" orient="auto">
					<polygon points="12 0, 0 6, 12 12" fill="#475569" />
				</marker>
				<marker id="arrowRightBlue" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto">
					<polygon points="0 0, 12 6, 0 12" fill="#3b82f6" />
				</marker>
				<marker id="arrowLeftBlue" markerWidth="12" markerHeight="12" refX="1" refY="6" orient="auto">
					<polygon points="12 0, 0 6, 12 12" fill="#3b82f6" />
				</marker>
				<marker id="arrowRightGreen" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto">
					<polygon points="0 0, 12 6, 0 12" fill="#10b981" />
				</marker>
			</defs>

			<!-- Title -->
			<text x="700" y="40" text-anchor="middle" font-size="32" font-weight="bold" fill="currentColor">
				SelfHost Agent: Installation & Communication Flow
			</text>

			<!-- Actors (left and right) -->
			<g id="actors">
				<!-- Control Panel (Left) -->
				<rect x="100" y="100" width="200" height="60" rx="8" fill="url(#controlPanelGrad)" stroke="#1e40af" stroke-width="3" />
				<text x="200" y="130" text-anchor="middle" font-size="18" font-weight="bold" fill="white">
					Control Panel
				</text>
				<text x="200" y="150" text-anchor="middle" font-size="14" fill="white" opacity="0.9">
					SelfHost
				</text>

				<!-- Server (Right) -->
				<rect x="1100" y="100" width="200" height="60" rx="8" fill="url(#serverGrad)" stroke="#d97706" stroke-width="3" />
				<text x="1200" y="130" text-anchor="middle" font-size="18" font-weight="bold" fill="white">
					Your Server
				</text>
				<text x="1200" y="150" text-anchor="middle" font-size="14" fill="white" opacity="0.9">
					Fresh OS
				</text>
			</g>

			<!-- Lifelines -->
			<line x1="200" y1="160" x2="200" y2="950" stroke="#64748b" stroke-width="2" stroke-dasharray="5,5" opacity="0.5" />
			<line x1="1200" y1="160" x2="1200" y2="950" stroke="#64748b" stroke-width="2" stroke-dasharray="5,5" opacity="0.5" />

			<!-- Phase 1: Initial Setup -->
			<g id="phase1">
				<rect x="50" y="200" width="1300" height="280" rx="8" fill="#fef3c7" stroke="#fbbf24" stroke-width="2" opacity="0.2" />
				<text x="700" y="230" text-anchor="middle" font-size="20" font-weight="bold" fill="#92400e">
					Phase 1: Initial Setup (One-Time Only)
				</text>

				<!-- Step 1: SSH Connection -->
				<g id="step1">
					<line x1="200" y1="260" x2="1200" y2="260" stroke="#475569" stroke-width="3" marker-end="url(#arrowRight)" />
					<text x="700" y="255" text-anchor="middle" font-size="14" font-weight="bold" fill="#475569">
						1. Establish SSH Connection
					</text>
					<text x="700" y="270" text-anchor="middle" font-size="12" fill="#64748b">
						Port 22 (Inbound)
					</text>
					<circle cx="200" cy="260" r="5" fill="#3b82f6" />
					<circle cx="1200" cy="260" r="5" fill="#f59e0b" />
				</g>

				<!-- Step 2: Upload Agent -->
				<g id="step2">
					<line x1="200" y1="320" x2="1200" y2="320" stroke="#475569" stroke-width="3" marker-end="url(#arrowRight)" />
					<text x="700" y="315" text-anchor="middle" font-size="14" font-weight="bold" fill="#475569">
						2. Upload Agent Code
					</text>
					<text x="700" y="330" text-anchor="middle" font-size="12" fill="#64748b">
						Transfer agent.ts & dependencies
					</text>
					<circle cx="200" cy="320" r="5" fill="#3b82f6" />
					<circle cx="1200" cy="320" r="5" fill="#f59e0b" />
				</g>

				<!-- Step 3: Install Service -->
				<g id="step3">
					<line x1="200" y1="380" x2="1200" y2="380" stroke="#475569" stroke-width="3" marker-end="url(#arrowRight)" />
					<text x="700" y="375" text-anchor="middle" font-size="14" font-weight="bold" fill="#475569">
						3. Install & Configure Service
					</text>
					<text x="700" y="390" text-anchor="middle" font-size="12" fill="#64748b">
						Create systemd/OpenRC service file
					</text>
					<circle cx="200" cy="380" r="5" fill="#3b82f6" />
					<circle cx="1200" cy="380" r="5" fill="#f59e0b" />
				</g>

				<!-- Step 4: Start Service -->
				<g id="step4">
					<line x1="200" y1="440" x2="1200" y2="440" stroke="#475569" stroke-width="3" marker-end="url(#arrowRight)" />
					<text x="700" y="435" text-anchor="middle" font-size="14" font-weight="bold" fill="#475569">
						4. Start Agent Service
					</text>
					<text x="700" y="450" text-anchor="middle" font-size="12" fill="#64748b">
						Service starts, attempts connection
					</text>
					<circle cx="200" cy="440" r="5" fill="#3b82f6" />
					<circle cx="1200" cy="440" r="5" fill="#10b981" />
				</g>
			</g>

			<!-- Phase 2: Connection Establishment -->
			<g id="phase2">
				<rect x="50" y="500" width="1300" height="120" rx="8" fill="#dbeafe" stroke="#3b82f6" stroke-width="2" opacity="0.2" />
				<text x="700" y="530" text-anchor="middle" font-size="20" font-weight="bold" fill="#1e40af">
					Phase 2: Connection Establishment
				</text>

				<!-- Step 5: Agent Connects -->
				<g id="step5">
					<line x1="1200" y1="560" x2="200" y2="560" stroke="#06b6d4" stroke-width="4" marker-end="url(#arrowLeftBlue)" />
					<text x="700" y="555" text-anchor="middle" font-size="14" font-weight="bold" fill="#06b6d4">
						5. Agent Initiates WebSocket Connection
					</text>
					<text x="700" y="570" text-anchor="middle" font-size="12" fill="#0891b2">
						Outbound to Control Panel (Port 443/WSS)
					</text>
					<circle cx="1200" cy="560" r="5" fill="#10b981" />
					<circle cx="200" cy="560" r="5" fill="#3b82f6" />
				</g>

				<!-- Step 6: Connection Confirmed -->
				<g id="step6">
					<line x1="200" y1="600" x2="1200" y2="600" stroke="#10b981" stroke-width="3" marker-end="url(#arrowRightGreen)" />
					<text x="700" y="595" text-anchor="middle" font-size="14" font-weight="bold" fill="#10b981">
						6. Connection Confirmed
					</text>
					<text x="700" y="610" text-anchor="middle" font-size="12" fill="#059669">
						Handshake complete, ready for commands
					</text>
					<circle cx="200" cy="600" r="5" fill="#3b82f6" />
					<circle cx="1200" cy="600" r="5" fill="#10b981" />
				</g>
			</g>

			<!-- Phase 3: Ongoing Operations -->
			<g id="phase3">
				<rect x="50" y="640" width="1300" height="280" rx="8" fill="#dbeafe" stroke="#3b82f6" stroke-width="2" opacity="0.2" />
				<text x="700" y="670" text-anchor="middle" font-size="20" font-weight="bold" fill="#1e40af">
					Phase 3: Ongoing Operations (Persistent)
				</text>

				<!-- Step 7: Health Reports (Continuous) -->
				<g id="step7">
					<line x1="1200" y1="710" x2="200" y2="710" stroke="#10b981" stroke-width="3" marker-end="url(#arrowLeftBlue)" />
					<text x="700" y="705" text-anchor="middle" font-size="14" font-weight="bold" fill="#10b981">
						7. Health Reports (Every 5 seconds)
					</text>
					<text x="700" y="720" text-anchor="middle" font-size="12" fill="#059669">
						CPU, Memory, Disk, Service Status
					</text>
					<circle cx="1200" cy="710" r="5" fill="#10b981" />
					<circle cx="200" cy="710" r="5" fill="#3b82f6" />
				</g>

				<!-- Step 8: Deploy Command -->
				<g id="step8">
					<line x1="200" y1="770" x2="1200" y2="770" stroke="#3b82f6" stroke-width="3" marker-end="url(#arrowRightBlue)" />
					<text x="700" y="765" text-anchor="middle" font-size="14" font-weight="bold" fill="#3b82f6">
						8. Deploy Application Command
					</text>
					<text x="700" y="780" text-anchor="middle" font-size="12" fill="#2563eb">
						Send deployment instructions
					</text>
					<circle cx="200" cy="770" r="5" fill="#3b82f6" />
					<circle cx="1200" cy="770" r="5" fill="#10b981" />
				</g>

				<!-- Step 9: Execution Status -->
				<g id="step9">
					<line x1="1200" y1="830" x2="200" y2="830" stroke="#10b981" stroke-width="3" marker-end="url(#arrowLeftBlue)" />
					<text x="700" y="825" text-anchor="middle" font-size="14" font-weight="bold" fill="#10b981">
						9. Stream Execution Output
					</text>
					<text x="700" y="840" text-anchor="middle" font-size="12" fill="#059669">
						Real-time logs, progress updates
					</text>
					<circle cx="1200" cy="830" r="5" fill="#10b981" />
					<circle cx="200" cy="830" r="5" fill="#3b82f6" />
				</g>

				<!-- Step 10: Completion Status -->
				<g id="step10">
					<line x1="1200" y1="890" x2="200" y2="890" stroke="#10b981" stroke-width="3" marker-end="url(#arrowLeftBlue)" />
					<text x="700" y="885" text-anchor="middle" font-size="14" font-weight="bold" fill="#10b981">
						10. Deployment Complete
					</text>
					<text x="700" y="900" text-anchor="middle" font-size="12" fill="#059669">
						Success/failure status, final state
					</text>
					<circle cx="1200" cy="890" r="5" fill="#10b981" />
					<circle cx="200" cy="890" r="5" fill="#3b82f6" />
				</g>
			</g>

			<!-- Legend -->
			<g id="legend">
				<rect x="50" y="950" width="1300" height="40" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />
				<text x="100" y="975" font-size="14" font-weight="bold" fill="currentColor">Legend:</text>
				<line x1="200" y1="970" x2="250" y2="970" stroke="#475569" stroke-width="3" marker-end="url(#arrowRight)" />
				<text x="260" y="975" font-size="12" fill="currentColor">SSH/Setup</text>
				<line x1="400" y1="970" x2="450" y2="970" stroke="#3b82f6" stroke-width="3" marker-end="url(#arrowRightBlue)" />
				<text x="460" y="975" font-size="12" fill="currentColor">Control Panel → Agent</text>
				<line x1="650" y1="970" x2="600" y2="970" stroke="#3b82f6" stroke-width="3" marker-end="url(#arrowLeftBlue)" />
				<text x="610" y="975" font-size="12" fill="currentColor">Agent → Control Panel</text>
				<line x1="850" y1="970" x2="900" y2="970" stroke="#10b981" stroke-width="3" marker-end="url(#arrowRightGreen)" />
				<text x="910" y="975" font-size="12" fill="currentColor">Health/Status</text>
			</g>
		</svg>
	</div>

	<button
		onclick={openFullscreen}
		class="absolute top-4 right-4 p-2 rounded-md bg-background/90 border border-border opacity-0 group-hover:opacity-100 transition-all hover:bg-background hover:border-primary z-10"
		aria-label="View fullscreen"
		title="View fullscreen"
	>
		<Maximize2 class="size-5" />
	</button>
</div>

{#if isFullscreen}
	<div
		bind:this={fullscreenOverlay}
		class="fixed inset-0 z-[9999] bg-background p-8 overflow-auto"
		role="dialog"
		aria-modal="true"
		aria-label="Agent Architecture Diagram - Fullscreen"
	>
		<button
			onclick={closeFullscreen}
			class="absolute top-4 right-4 p-3 rounded-md bg-background border-2 border-border hover:border-primary transition-all z-10"
			aria-label="Close fullscreen"
		>
			<X class="size-6" />
		</button>
		<div class="w-full h-full flex items-center justify-center">
			<div class="w-full max-w-7xl">
				<svg
					viewBox="0 0 1400 1000"
					class="w-full h-auto"
					preserveAspectRatio="xMidYMid meet"
				>
					<!-- Same SVG content as above but with larger viewBox for fullscreen -->
					<defs>
						<linearGradient id="controlPanelGradFs" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
							<stop offset="100%" style="stop-color:#2563eb;stop-opacity:1" />
						</linearGradient>
						<linearGradient id="serverGradFs" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
							<stop offset="100%" style="stop-color:#d97706;stop-opacity:1" />
						</linearGradient>
						<linearGradient id="agentGradFs" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
							<stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
						</linearGradient>
						<marker id="arrowRightFs" markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto">
							<polygon points="0 0, 14 7, 0 14" fill="#475569" />
						</marker>
						<marker id="arrowLeftFs" markerWidth="14" markerHeight="14" refX="1" refY="7" orient="auto">
							<polygon points="14 0, 0 7, 14 14" fill="#475569" />
						</marker>
						<marker id="arrowRightBlueFs" markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto">
							<polygon points="0 0, 14 7, 0 14" fill="#3b82f6" />
						</marker>
						<marker id="arrowLeftBlueFs" markerWidth="14" markerHeight="14" refX="1" refY="7" orient="auto">
							<polygon points="14 0, 0 7, 14 14" fill="#3b82f6" />
						</marker>
						<marker id="arrowRightGreenFs" markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto">
							<polygon points="0 0, 14 7, 0 14" fill="#10b981" />
						</marker>
					</defs>

					<text x="700" y="50" text-anchor="middle" font-size="40" font-weight="bold" fill="currentColor">
						SelfHost Agent: Installation & Communication Flow
					</text>

					<g id="actors-fs">
						<rect x="100" y="120" width="200" height="70" rx="8" fill="url(#controlPanelGradFs)" stroke="#1e40af" stroke-width="3" />
						<text x="200" y="150" text-anchor="middle" font-size="20" font-weight="bold" fill="white">
							Control Panel
						</text>
						<text x="200" y="175" text-anchor="middle" font-size="16" fill="white" opacity="0.9">
							SelfHost
						</text>

						<rect x="1100" y="120" width="200" height="70" rx="8" fill="url(#serverGradFs)" stroke="#d97706" stroke-width="3" />
						<text x="1200" y="150" text-anchor="middle" font-size="20" font-weight="bold" fill="white">
							Your Server
						</text>
						<text x="1200" y="175" text-anchor="middle" font-size="16" fill="white" opacity="0.9">
							Fresh OS
						</text>
					</g>

					<line x1="200" y1="190" x2="200" y2="950" stroke="#64748b" stroke-width="2" stroke-dasharray="5,5" opacity="0.5" />
					<line x1="1200" y1="190" x2="1200" y2="950" stroke="#64748b" stroke-width="2" stroke-dasharray="5,5" opacity="0.5" />

					<!-- Phase 1 -->
					<g id="phase1-fs">
						<rect x="50" y="220" width="1300" height="300" rx="8" fill="#fef3c7" stroke="#fbbf24" stroke-width="2" opacity="0.2" />
						<text x="700" y="250" text-anchor="middle" font-size="24" font-weight="bold" fill="#92400e">
							Phase 1: Initial Setup (One-Time Only)
						</text>

						<g id="step1-fs">
							<line x1="200" y1="290" x2="1200" y2="290" stroke="#475569" stroke-width="4" marker-end="url(#arrowRightFs)" />
							<text x="700" y="285" text-anchor="middle" font-size="16" font-weight="bold" fill="#475569">
								1. Establish SSH Connection
							</text>
							<text x="700" y="302" text-anchor="middle" font-size="14" fill="#64748b">
								Port 22 (Inbound)
							</text>
							<circle cx="200" cy="290" r="6" fill="#3b82f6" />
							<circle cx="1200" cy="290" r="6" fill="#f59e0b" />
						</g>

						<g id="step2-fs">
							<line x1="200" y1="350" x2="1200" y2="350" stroke="#475569" stroke-width="4" marker-end="url(#arrowRightFs)" />
							<text x="700" y="345" text-anchor="middle" font-size="16" font-weight="bold" fill="#475569">
								2. Upload Agent Code
							</text>
							<text x="700" y="362" text-anchor="middle" font-size="14" fill="#64748b">
								Transfer agent.ts & dependencies
							</text>
							<circle cx="200" cy="350" r="6" fill="#3b82f6" />
							<circle cx="1200" cy="350" r="6" fill="#f59e0b" />
						</g>

						<g id="step3-fs">
							<line x1="200" y1="410" x2="1200" y2="410" stroke="#475569" stroke-width="4" marker-end="url(#arrowRightFs)" />
							<text x="700" y="405" text-anchor="middle" font-size="16" font-weight="bold" fill="#475569">
								3. Install & Configure Service
							</text>
							<text x="700" y="422" text-anchor="middle" font-size="14" fill="#64748b">
								Create systemd/OpenRC service file
							</text>
							<circle cx="200" cy="410" r="6" fill="#3b82f6" />
							<circle cx="1200" cy="410" r="6" fill="#f59e0b" />
						</g>

						<g id="step4-fs">
							<line x1="200" y1="470" x2="1200" y2="470" stroke="#475569" stroke-width="4" marker-end="url(#arrowRightFs)" />
							<text x="700" y="465" text-anchor="middle" font-size="16" font-weight="bold" fill="#475569">
								4. Start Agent Service
							</text>
							<text x="700" y="482" text-anchor="middle" font-size="14" fill="#64748b">
								Service starts, attempts connection
							</text>
							<circle cx="200" cy="470" r="6" fill="#3b82f6" />
							<circle cx="1200" cy="470" r="6" fill="#10b981" />
						</g>
					</g>

					<!-- Phase 2 -->
					<g id="phase2-fs">
						<rect x="50" y="540" width="1300" height="140" rx="8" fill="#dbeafe" stroke="#3b82f6" stroke-width="2" opacity="0.2" />
						<text x="700" y="570" text-anchor="middle" font-size="24" font-weight="bold" fill="#1e40af">
							Phase 2: Connection Establishment
						</text>

						<g id="step5-fs">
							<line x1="1200" y1="610" x2="200" y2="610" stroke="#06b6d4" stroke-width="5" marker-end="url(#arrowLeftBlueFs)" />
							<text x="700" y="605" text-anchor="middle" font-size="16" font-weight="bold" fill="#06b6d4">
								5. Agent Initiates WebSocket Connection
							</text>
							<text x="700" y="622" text-anchor="middle" font-size="14" fill="#0891b2">
								Outbound to Control Panel (Port 443/WSS)
							</text>
							<circle cx="1200" cy="610" r="6" fill="#10b981" />
							<circle cx="200" cy="610" r="6" fill="#3b82f6" />
						</g>

						<g id="step6-fs">
							<line x1="200" y1="650" x2="1200" y2="650" stroke="#10b981" stroke-width="4" marker-end="url(#arrowRightGreenFs)" />
							<text x="700" y="645" text-anchor="middle" font-size="16" font-weight="bold" fill="#10b981">
								6. Connection Confirmed
							</text>
							<text x="700" y="662" text-anchor="middle" font-size="14" fill="#059669">
								Handshake complete, ready for commands
							</text>
							<circle cx="200" cy="650" r="6" fill="#3b82f6" />
							<circle cx="1200" cy="650" r="6" fill="#10b981" />
						</g>
					</g>

					<!-- Phase 3 -->
					<g id="phase3-fs">
						<rect x="50" y="700" width="1300" height="300" rx="8" fill="#dbeafe" stroke="#3b82f6" stroke-width="2" opacity="0.2" />
						<text x="700" y="730" text-anchor="middle" font-size="24" font-weight="bold" fill="#1e40af">
							Phase 3: Ongoing Operations (Persistent)
						</text>

						<g id="step7-fs">
							<line x1="1200" y1="780" x2="200" y2="780" stroke="#10b981" stroke-width="4" marker-end="url(#arrowLeftBlueFs)" />
							<text x="700" y="775" text-anchor="middle" font-size="16" font-weight="bold" fill="#10b981">
								7. Health Reports (Every 5 seconds)
							</text>
							<text x="700" y="792" text-anchor="middle" font-size="14" fill="#059669">
								CPU, Memory, Disk, Service Status
							</text>
							<circle cx="1200" cy="780" r="6" fill="#10b981" />
							<circle cx="200" cy="780" r="6" fill="#3b82f6" />
						</g>

						<g id="step8-fs">
							<line x1="200" y1="840" x2="1200" y2="840" stroke="#3b82f6" stroke-width="4" marker-end="url(#arrowRightBlueFs)" />
							<text x="700" y="835" text-anchor="middle" font-size="16" font-weight="bold" fill="#3b82f6">
								8. Deploy Application Command
							</text>
							<text x="700" y="852" text-anchor="middle" font-size="14" fill="#2563eb">
								Send deployment instructions
							</text>
							<circle cx="200" cy="840" r="6" fill="#3b82f6" />
							<circle cx="1200" cy="840" r="6" fill="#10b981" />
						</g>

						<g id="step9-fs">
							<line x1="1200" y1="900" x2="200" y2="900" stroke="#10b981" stroke-width="4" marker-end="url(#arrowLeftBlueFs)" />
							<text x="700" y="895" text-anchor="middle" font-size="16" font-weight="bold" fill="#10b981">
								9. Stream Execution Output
							</text>
							<text x="700" y="912" text-anchor="middle" font-size="14" fill="#059669">
								Real-time logs, progress updates
							</text>
							<circle cx="1200" cy="900" r="6" fill="#10b981" />
							<circle cx="200" cy="900" r="6" fill="#3b82f6" />
						</g>

						<g id="step10-fs">
							<line x1="1200" y1="960" x2="200" y2="960" stroke="#10b981" stroke-width="4" marker-end="url(#arrowLeftBlueFs)" />
							<text x="700" y="955" text-anchor="middle" font-size="16" font-weight="bold" fill="#10b981">
								10. Deployment Complete
							</text>
							<text x="700" y="972" text-anchor="middle" font-size="14" fill="#059669">
								Success/failure status, final state
							</text>
							<circle cx="1200" cy="960" r="6" fill="#10b981" />
							<circle cx="200" cy="960" r="6" fill="#3b82f6" />
						</g>
					</g>

					<g id="legend-fs">
						<rect x="50" y="1020" width="1300" height="50" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />
						<text x="100" y="1045" font-size="16" font-weight="bold" fill="currentColor">Legend:</text>
						<line x1="200" y1="1040" x2="260" y2="1040" stroke="#475569" stroke-width="4" marker-end="url(#arrowRightFs)" />
						<text x="270" y="1045" font-size="14" fill="currentColor">SSH/Setup</text>
						<line x1="400" y1="1040" x2="460" y2="1040" stroke="#3b82f6" stroke-width="4" marker-end="url(#arrowRightBlueFs)" />
						<text x="470" y="1045" font-size="14" fill="currentColor">Control Panel → Agent</text>
						<line x1="700" y1="1040" x2="640" y2="1040" stroke="#3b82f6" stroke-width="4" marker-end="url(#arrowLeftBlueFs)" />
						<text x="630" y="1045" font-size="14" fill="currentColor">Agent → Control Panel</text>
						<line x1="900" y1="1040" x2="960" y2="1040" stroke="#10b981" stroke-width="4" marker-end="url(#arrowRightGreenFs)" />
						<text x="970" y="1045" font-size="14" fill="currentColor">Health/Status</text>
					</g>
				</svg>
			</div>
		</div>
	</div>
{/if}

<style>
	.agent-architecture-diagram {
		position: relative;
	}

	.diagram-container {
		background: linear-gradient(135deg, rgba(0, 0, 0, 0.02) 0%, rgba(0, 0, 0, 0.05) 100%);
	}

	:global(.dark .diagram-container) {
		background: linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.5) 100%);
	}

	.agent-architecture-diagram:hover button {
		opacity: 1;
	}
</style>
