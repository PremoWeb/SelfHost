import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const buildToZig = process.env.BUILD_TO_ZIG === '1' || process.env.BUILD_TO_ZIG === 'true';
const outDir = buildToZig ? '../zig/frontend' : 'build';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: outDir,
			assets: outDir,
			fallback: 'index.html',
			precompress: false,
			strict: false
		}),
		prerender: { 
            entries: ['/'],
            handleUnseenRoutes: 'warn'
        }
	},
	compilerOptions: {
		experimental: { async: true }
	}
};

export default config;
