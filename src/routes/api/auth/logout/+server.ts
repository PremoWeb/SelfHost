import { json, redirect } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/auth/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies, request }) => {
	if (locals.sessionId) {
		await deleteSession(locals.sessionId);
	}

	// Clear session cookie
	cookies.delete('session', { path: '/' });

	// Always redirect to "/" for form submissions (progressive enhancement)
	// This works with both JS-enabled (use:enhance) and non-JS (progressive enhancement)
	// Only return JSON if explicitly requested via Accept header
	const acceptHeader = request.headers.get('accept') || '';
	const isExplicitApiCall = acceptHeader.includes('application/json') && 
	                          !acceptHeader.includes('text/html') &&
	                          !acceptHeader.includes('*/*');
	
	// For form submissions, always redirect to "/"
	// For explicit API calls, return JSON response
	if (!isExplicitApiCall) {
		throw redirect(303, '/');
	}

	return json({ message: 'Logged out successfully' });
};
