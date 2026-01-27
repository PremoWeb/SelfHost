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
		allowedHosts: true
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
