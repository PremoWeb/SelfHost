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
			'/api': { target: 'http://localhost:3000', changeOrigin: true },
			'/ws': { target: 'ws://localhost:3000', ws: true }
		}
	},
	optimizeDeps: {
		include: ['lucide-svelte', 'axios', 'clsx', 'tailwind-merge', 'bits-ui']
	}
});
