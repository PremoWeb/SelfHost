import tailwindcss from '@tailwindcss/vite';
import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { agentWebSocketPlugin } from './agent-websocket-plugin';

export default defineConfig({ 
    plugins: [
        agentWebSocketPlugin(),
        tailwindcss(), 
        sveltekit(), 
        devtoolsJson()
    ],
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
