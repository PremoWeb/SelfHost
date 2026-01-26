import tailwindcss from '@tailwindcss/vite';
import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
    plugins: [
        // agentWebSocketPlugin(),
        tailwindcss(),
        sveltekit(),
        devtoolsJson(),
        process.env.ANALYZE === 'true' && visualizer({
            emitFile: true,
            filename: 'stats.html'
        })
    ].filter(Boolean),
    // ... rest of config
	resolve: {
		dedupe: ['three'],
        alias: {
            'child_process': 'node:child_process',
            'fs': 'node:fs',
            'path': 'node:path',
            'util': 'node:util',
            'crypto': 'node:crypto',
            'perf_hooks': 'node:perf_hooks',
            'fs/promises': 'node:fs/promises',
        }
	},
	server: {
		host: false,
		port: 5173,
		strictPort: true,
		allowedHosts: true
	},
	ssr: {
		noExternal: ['bits-ui'],
        external: ['node:child_process', 'node:util', 'node:perf_hooks', 'node:fs/promises', 'node:fs', 'node:path', 'node:crypto', 'child_process', 'util', 'perf_hooks', 'fs/promises', 'fs', 'path', 'crypto']
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
