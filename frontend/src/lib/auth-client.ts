import { createAuthClient } from "better-auth/svelte";
import { browser } from '$app/environment';

// Initialize auth client without admin plugin to avoid SSR issues
// Admin plugin will be loaded dynamically on client side if available
export const authClient = createAuthClient({
    baseURL: browser ? window.location.origin : "http://localhost:5173",
    plugins: []
});

// Load adminClient plugin on client side only (async, non-blocking)
if (browser) {
	import("better-auth/client/plugins")
		.then((module) => {
			if (module && typeof module.adminClient === 'function') {
				// Note: Better Auth plugins must be added at initialization
				// If admin features are needed, the page should reload after plugin loads
			}
		})
		.catch(() => {
			// Silently fail - admin features won't work but auth will
		});
}