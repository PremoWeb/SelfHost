import adapterBun from 'svelte-adapter-bun';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const buildForZig = process.env.BUILD_FOR_ZIG === 'true';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: buildForZig
			? adapterStatic({
					fallback: 'index.html',
					precompress: false,
					strict: false
				})
			: adapterBun(),
		prerender: buildForZig ? { entries: ['/'] } : undefined,
		experimental: {
			remoteFunctions: true
		}
	},
	compilerOptions: {
		experimental: {
			async: true
		}
	}
};

export default config;
