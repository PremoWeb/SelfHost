/**
 * Root layout config.
 * When building for Zig backend (PUBLIC_BUILD_FOR_ZIG=true), we build as SPA:
 * ssr = false, prerender = true so only "/" is prerendered and fallback serves the rest.
 */
import { PUBLIC_BUILD_FOR_ZIG } from '$env/static/public';

const buildForZig = (PUBLIC_BUILD_FOR_ZIG ?? '') === 'true';

export const ssr = !buildForZig;
export const prerender = buildForZig;
