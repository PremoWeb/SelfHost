import tailwindcss from '@tailwindcss/vite';
import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { agentWebSocketPlugin } from './agent-websocket-plugin';

export default defineConfig({
    plugins: [
        agentWebSocketPlugin(),
        tailwindcss(),
        sveltekit(),
        devtoolsJson(),
        process.env.ANALYZE === 'true' && visualizer({
            emitFile: true,
            filename: 'stats.html'
        })
    ].filter(Boolean),
	resolve: {
		dedupe: ['three']
	},
	server: {
		host: false,
		port: 5173,
		strictPort: true,
		allowedHosts: true,
		preTransformRequests: false, // Don't crawl the whole app on start
		// Proxy API/WS to Zig backend when ZIG_BACKEND=true (Zig default port 3000)
		proxy: process.env.ZIG_BACKEND === 'true' ? {
			'/api/agent': {
				target: 'ws://localhost:3000',
				ws: true,
				changeOrigin: true,
			},
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true,
				rewrite: (path) => path,
				ws: true,
			},
			'/ws': {
				target: 'ws://localhost:3000',
				ws: true,
			},
		} : undefined,
		watch: {
			ignored: [
				'**/data/**', 
				'**/*.db', 
				'**/*.db-journal', 
				'**/*.db-shm', 
				'**/*.db-wal',
				'**/node_modules/**',
				'**/.git/**',
				'**/build/**',
				'**/.svelte-kit/**'
			]
		}
	},
	optimizeDeps: {
		include: [
			'three',
			'three-globe',
			'lucide-svelte',
			'axios',
			'clsx',
			'tailwind-merge',
			'bits-ui'
		]
	},
	ssr: {
		target: 'node',
		noExternal: ['bits-ui'],
		external: [
			'node:crypto',
			'node:fs',
			'node:path',
			'node:util',
			'node:child_process',
			'node:perf_hooks',
			'node:fs/promises'
		]
	},
    build: {
        rollupOptions: {
            onwarn(warning, warn) {
                if (warning.code === 'UNUSED_EXTERNAL_IMPORT' && (warning as any).source?.includes('better-auth')) return;
                if (warning.code === 'UNRESOLVED_IMPORT' && ['child_process', 'util', 'fs', 'path', 'crypto', 'perf_hooks', 'fs/promises'].some(m => (warning as any).source?.includes(m))) return;
                warn(warning);
            }
        }
    }
});
