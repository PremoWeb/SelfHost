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
        visualizer({
            emitFile: true,
            filename: 'stats.html'
        })
    ],
    // ... rest of config
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
		noExternal: ['bits-ui']
	}
});
