<script lang="ts">
	import { onMount } from 'svelte';
	import { Globe as GlobeIcon } from 'lucide-svelte';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';

	let { servers = [] }: { servers: any[] } = $props();

	let container: HTMLDivElement;
	let globeInstance: any = $state(null);

	// Accurate Lat/Long for regions
	const regionCoords: Record<string, { lat: number; lng: number }> = {
		sjc: { lat: 37.3382, lng: -121.8863 }, // San Jose
		lax: { lat: 34.0522, lng: -118.2437 }, // Los Angeles
		nj: { lat: 40.7128, lng: -74.006 }, // New Jersey / NY
		mia: { lat: 25.7617, lng: -80.1918 }, // Miami
		dfw: { lat: 32.7767, lng: -96.797 }, // Dallas
		pdx: { lat: 45.5152, lng: -122.6784 }, // Portland
		sea: { lat: 47.6062, lng: -122.3321 }, // Seattle
		fra: { lat: 50.1109, lng: 8.6821 }, // Frankfurt
		lhr: { lat: 51.5074, lng: -0.1278 }, // London
		ber: { lat: 52.52, lng: 13.405 }, // Berlin
		ams: { lat: 52.3676, lng: 4.9041 }, // Amsterdam
		atl: { lat: 33.749, lng: -84.388 }, // Atlanta
		icn: { lat: 37.5665, lng: 126.978 }, // Seoul
		jnb: { lat: -26.2041, lng: 28.0473 }, // Johannesburg
		mel: { lat: -37.8136, lng: 144.9631 }, // Melbourne
		mex: { lat: 19.4326, lng: -99.1332 }, // Mexico City
		bom: { lat: 19.076, lng: 72.8777 }, // Mumbai
		ord: { lat: 41.8781, lng: -87.6298 }, // Chicago
		cdg: { lat: 48.8566, lng: 2.3522 }, // Paris
		scl: { lat: -33.4489, lng: -70.6693 }, // Santiago
		sin: { lat: 1.3521, lng: 103.8198 }, // Singapore
		sto: { lat: 59.3293, lng: 18.0686 }, // Stockholm
		syd: { lat: -33.8688, lng: 151.2093 }, // Sydney
		nrt: { lat: 35.6762, lng: 139.6503 }, // Tokyo
		yto: { lat: 43.6532, lng: -79.3832 }, // Toronto
		waw: { lat: 52.2297, lng: 21.0122 } // Warsaw
	};

	// Consolidate servers into globe data by region
	let globeData = $derived.by(() => {
		const groups: Record<string, any[]> = {};

		servers.forEach((s) => {
			const region = s.region?.toLowerCase();
			if (region && regionCoords[region]) {
				if (!groups[region]) groups[region] = [];
				groups[region].push(s);
			}
		});

		return Object.entries(groups).map(([region, regionServers]) => {
			const coords = regionCoords[region];
			const count = regionServers.length;
			const hasCluster = regionServers.some(
				(s) =>
					(Array.isArray(s.tags) &&
						s.tags.some((t: string) =>
							['swarm', 'cluster', 'kubernetes', 'k8s'].includes(t.toLowerCase())
						)) ||
					['swarm', 'kubernetes'].includes(s.type?.toLowerCase())
			);

			const onlineCount = regionServers.filter((s) => s.status === 'online').length;
			const status = onlineCount > 0 ? 'online' : 'offline';

			let label = '';
			if (count === 1) {
				const s = regionServers[0];
				label = `${s.name || s.hostname} - ${region.toUpperCase()}`;
			} else if (hasCluster) {
				label = `${region.toUpperCase()} Cluster (${count} nodes)`;
			} else {
				label = `${count} Servers - ${region.toUpperCase()}`;
			}

			return {
				lat: coords.lat,
				lng: coords.lng,
				name: label,
				status,
				count
			};
		});
	});

	onMount(() => {
		let cleanup: (() => void) | undefined;

		const initGlobe = async () => {
			try {
				// Import Three.js modules - using namespace import for better compatibility
				const THREE = await import('three');
				const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
				const ThreeGlobeModule = await import('three-globe');
				const ThreeGlobe = ThreeGlobeModule.default;

				// Get container dimensions
				const width = container.clientWidth || 800;
				const height = container.clientHeight || 450;

				// Create scene
				const scene = new THREE.Scene();
				scene.background = new THREE.Color(0x000000);

				// Create camera (closer position for larger globe)
				const camera = new THREE.PerspectiveCamera(75, width / height, 1, 2000);
				camera.position.z = 140;

				// Create renderer
				const renderer = new THREE.WebGLRenderer({
					antialias: true,
					alpha: true,
					powerPreference: 'high-performance'
				});
				renderer.setPixelRatio(window.devicePixelRatio);
				renderer.setSize(width, height);
				container.appendChild(renderer.domElement);

				// Create globe with bright day texture and custom vertical projection lines
				const globe = new ThreeGlobe()
					.globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
					.bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
					.showAtmosphere(true)
					.atmosphereColor('#3b82f6')
					// Custom layer for vertical lines only (no text)
					.customLayerData(globeData)
					.customThreeObject((d: any) => {
						const group = new THREE.Group();

						// Create vertical line (cylinder) reaching exactly to label altitude
						const lineHeight = 10;
						const lineGeometry = new THREE.CylinderGeometry(0.15, 0.15, lineHeight, 8);
						const lineMaterial = new THREE.MeshBasicMaterial({
							color: d.status === 'online' ? 0x3b82f6 : 0x64748b,
							transparent: true,
							opacity: 0.85
						});
						const line = new THREE.Mesh(lineGeometry, lineMaterial);
						line.position.y = lineHeight / 2;
						group.add(line);

						// Small dot at the base
						const dotGeometry = new THREE.SphereGeometry(0.4, 12, 12);
						const dotMaterial = new THREE.MeshBasicMaterial({
							color: d.status === 'online' ? 0x3b82f6 : 0x64748b
						});
						const dot = new THREE.Mesh(dotGeometry, dotMaterial);
						group.add(dot);

						return group;
					})
					.customThreeObjectUpdate((obj: any, d: any) => {
						const altitude = 0;
						Object.assign(obj.position, globe.getCoords(d.lat, d.lng, altitude));
						obj.lookAt(new THREE.Vector3(0, 0, 0));
						obj.rotateX(Math.PI / 2);
					})
					// Using only labelsData to avoid doubling
					.labelsData(globeData)
					.labelLat('lat')
					.labelLng('lng')
					.labelText((d: any) => d.name)
					.labelSize(0.6)
					.labelDotRadius(0)
					.labelColor(() => '#ffffff')
					.labelResolution(4)
					.labelAltitude(0.1);

				scene.add(globe);

				// Store globe instance for reactive updates
				globeInstance = globe;

				// Add lights
				const ambientLight = new THREE.AmbientLight(0xffffff, 2);
				scene.add(ambientLight);

				const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
				directionalLight.position.set(100, 100, 500);
				scene.add(directionalLight);

				// Add controls
				const controls = new OrbitControls(camera, renderer.domElement);
				controls.enableDamping = true;
				controls.dampingFactor = 0.05;
				controls.rotateSpeed = 0.5;
				controls.enableZoom = true;
				controls.autoRotate = true;
				controls.autoRotateSpeed = 1.2;
				controls.minDistance = 110;
				controls.maxDistance = 300;

				// Stop auto-rotate when user interacts
				controls.addEventListener('start', () => {
					controls.autoRotate = false;
				});

				// Handle resize
				const handleResize = () => {
					const w = container.clientWidth;
					const h = container.clientHeight;
					if (w === 0 || h === 0) return;
					camera.aspect = w / h;
					camera.updateProjectionMatrix();
					renderer.setSize(w, h);
				};
				window.addEventListener('resize', handleResize);

				// Animation loop
				let animationId: number;
				const animate = () => {
					animationId = requestAnimationFrame(animate);
					controls.update();
					renderer.render(scene, camera);
				};
				animate();

				// Cleanup function
				cleanup = () => {
					window.removeEventListener('resize', handleResize);
					if (animationId) cancelAnimationFrame(animationId);
					renderer.dispose();
					if (container && container.contains(renderer.domElement)) {
						container.removeChild(renderer.domElement);
					}
					globeInstance = null;
				};
			} catch (err) {
				console.error('Failed to initialize 3D Globe:', err);
			}
		};

		initGlobe();

		return () => {
			cleanup?.();
		};
	});

	// Update globe data when servers change (at component level)
	$effect(() => {
		if (globeInstance) {
			globeInstance.customLayerData(globeData);
			globeInstance.labelsData(globeData);
		}
	});
</script>

<Card.Root class="border-primary/10 from-background to-primary/5 overflow-hidden bg-linear-to-br">
	<Card.Header class="flex flex-row items-center justify-between pb-2">
		<div class="space-y-1">
			<Card.Title class="flex items-center gap-2 text-lg">
				<GlobeIcon class="text-primary size-5" />
				Global Infrastructure Control
			</Card.Title>
			<Card.Description>3D real-time visualization of your distributed nodes.</Card.Description>
		</div>
		<div class="flex items-center gap-2">
			<Badge variant="outline" class="font-mono text-[10px] uppercase">
				{servers.length} Active Nodes
			</Badge>
		</div>
	</Card.Header>
	<Card.Content class="relative h-[450px] p-0">
		<div bind:this={container} class="size-full bg-black"></div>

		<!-- Overlay for context -->
		<div class="pointer-events-none absolute bottom-6 left-6 space-y-2">
			<div class="flex items-center gap-2">
				<div class="bg-primary size-2 animate-pulse rounded-full"></div>
				<span class="text-[10px] font-bold tracking-widest text-white uppercase"
					>Live Telemetry Active</span
				>
			</div>
		</div>
	</Card.Content>
</Card.Root>

<style>
	:global(canvas) {
		outline: none;
	}
</style>
