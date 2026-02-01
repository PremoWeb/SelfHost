import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		// Co-locate HTML/assets with Zig: output to zig/frontend/ when BUILD_TO_ZIG=1
		outDir: process.env.BUILD_TO_ZIG ? path.resolve(__dirname, '../zig/frontend') : 'build',
		emptyOutDir: !!process.env.BUILD_TO_ZIG
	},
	server: {
		port: 5173,
		strictPort: true,
		proxy: {
			'/api/agent': {
				target: 'http://127.0.0.1:3000',
				ws: true,
				changeOrigin: false, // Keep original host for signature verification
			},
			'/api': { 
				target: 'http://127.0.0.1:3000', 
				changeOrigin: true, 
				ws: true,
			},
			'/ws': { target: 'ws://127.0.0.1:3000', ws: true }
		}
	},
	ssr: {
		noExternal: ['tailwind-variants', '@xterm/xterm', '@xterm/addon-fit', 'three', 'three-globe', 'mermaid']
	},
	optimizeDeps: {
		include: ['lucide-svelte', 'axios', 'clsx', 'tailwind-merge', 'bits-ui', 'mermaid', '@xterm/xterm', '@xterm/addon-fit', 'three', 'three-globe', 'shiki', 'tailwind-variants'],

	}
});
