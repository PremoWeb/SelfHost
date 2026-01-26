import type { LayoutServerLoad } from './$types';

/**
 * Public layout - minimal layout for landing page
 * No authentication required
 */
export const load: LayoutServerLoad = async () => {
	// Public layout doesn't need any data
	// Just return empty object
	return {};
};
