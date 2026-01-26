import { command, getRequestEvent } from '$app/server';
import { auth } from '$lib/server/auth/better-auth';
import { logAction } from '$lib/server/services/action-logger';
import type { Cookies } from '@sveltejs/kit';

import { dev } from '$app/environment';

/**
 * Parse Set-Cookie header and set cookie with all attributes
 */
function setCookieFromHeader(cookies: Cookies, cookieHeader: string) {
	// Parse Set-Cookie header: name=value; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=...
	const parts = cookieHeader.split(';').map(p => p.trim());
	const [name, value] = parts[0].split('=');
	
	if (!name || !value) return;
	
	// Extract cookie attributes
	const cookieOptions: any = {
		path: '/',
		httpOnly: false,
		sameSite: 'lax' as const,
		secure: !dev
	};
	
	for (let i = 1; i < parts.length; i++) {
		const part = parts[i].toLowerCase();
		if (part === 'httponly') {
			cookieOptions.httpOnly = true;
		} else if (part.startsWith('path=')) {
			cookieOptions.path = part.split('=')[1] || '/';
		} else if (part.startsWith('samesite=')) {
			const sameSiteValue = part.split('=')[1]?.toLowerCase();
			if (sameSiteValue === 'strict' || sameSiteValue === 'lax' || sameSiteValue === 'none') {
				cookieOptions.sameSite = sameSiteValue;
			}
		} else if (part === 'secure') {
			cookieOptions.secure = true;
		} else if (part.startsWith('max-age=')) {
			const maxAge = parseInt(part.split('=')[1] || '0', 10);
			if (!isNaN(maxAge) && maxAge > 0) {
				cookieOptions.maxAge = maxAge;
			}
		}
	}
	
	cookies.set(name.trim(), value.trim(), cookieOptions);
}

export const impersonateUser = command('unchecked', async ({ userId }: { userId: string }) => {
	const { locals, request, url, cookies } = getRequestEvent();
	
	if (!locals.user) {
		return { success: false, message: 'Unauthorized' };
	}

	const { isGod } = await import('$lib/server/auth/permissions');
	
	// Only God users can impersonate
	if (!(await isGod(locals.user.id))) {
		return { success: false, message: 'Unauthorized' };
	}

	try {
		// Better Auth admin plugin uses /admin/impersonate-user endpoint
		// Create a request to Better Auth's admin impersonate endpoint with proper cookies
		const cookieHeader = request.headers.get('cookie') || '';
		const impersonateRequest = new Request(new URL('/api/auth/admin/impersonate-user', url.origin), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': cookieHeader,
				...Object.fromEntries(
					Array.from(request.headers.entries()).filter(([key]) => 
						key.toLowerCase() !== 'cookie' && key.toLowerCase() !== 'content-type'
					)
				)
			},
			body: JSON.stringify({ userId })
		});

		// Use Better Auth's handler to process the request
		const response = await auth.handler(impersonateRequest);
		
		if (!response.ok) {
			const error = await response.json().catch(() => ({ message: 'Failed to impersonate user' }));
			return { success: false, message: error.message || 'Failed to impersonate user' };
		}

		// Extract and set cookies from Better Auth's response
		// Better Auth sets session cookies that need to be forwarded to the client
		const setCookieHeaders = response.headers.getSetCookie();
		for (const cookieHeader of setCookieHeaders) {
			setCookieFromHeader(cookies, cookieHeader);
		}

		const result = await response.json();
		
		// Log impersonation action
		const { getRequestEvent } = await import('$app/server');
		const event = getRequestEvent();
		if (event) {
			await logAction(locals, event, {
				action: 'user.impersonate',
				resourceType: 'user',
				resourceId: userId,
				method: 'POST',
				path: '/api/auth/admin/impersonate-user',
				metadata: { impersonatedUserId: userId }
			});
		}
		
		return { success: true, data: result };
	} catch (error: any) {
		// Log failed impersonation
		const { getRequestEvent } = await import('$app/server');
		const event = getRequestEvent();
		if (event) {
			await logAction(locals, event, {
				action: 'user.impersonate',
				resourceType: 'user',
				resourceId: userId,
				method: 'POST',
				path: '/api/auth/admin/impersonate-user',
				success: false,
				errorMessage: error.message || 'Failed to impersonate user',
				metadata: { impersonatedUserId: userId }
			});
		}
		
		return { success: false, message: error.message || 'Failed to impersonate user' };
	}
});

export const stopImpersonating = command('unchecked', async () => {
	const { locals, request, url, cookies } = getRequestEvent();
	
	if (!locals.user) {
		return { success: false, message: 'Unauthorized' };
	}

	// Check if it's user impersonation (Better Auth) or team/company (custom)
	const impersonatedType = cookies.get('impersonated_type') as 'user' | 'team' | 'company' | null;
	const betterAuthImpersonatedBy = locals.isImpersonating && locals.impersonationType === 'user';

	try {
		if (betterAuthImpersonatedBy || impersonatedType === 'user') {
			// Better Auth admin plugin uses /admin/stop-impersonating endpoint
			// Create a request to Better Auth's admin stop impersonating endpoint with proper cookies
			const cookieHeader = request.headers.get('cookie') || '';
			const stopRequest = new Request(new URL('/api/auth/admin/stop-impersonating', url.origin), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Cookie': cookieHeader,
					...Object.fromEntries(
						Array.from(request.headers.entries()).filter(([key]) => 
							key.toLowerCase() !== 'cookie' && key.toLowerCase() !== 'content-type'
						)
					)
				}
			});

			// Use Better Auth's handler to process the request
			const response = await auth.handler(stopRequest);
			
			if (!response.ok) {
				const error = await response.json().catch(() => ({ message: 'Failed to stop impersonating' }));
				return { success: false, message: error.message || 'Failed to stop impersonating' };
			}

			// Extract and set cookies from Better Auth's response
			const setCookieHeaders = response.headers.getSetCookie();
			for (const cookieHeader of setCookieHeaders) {
				setCookieFromHeader(cookies, cookieHeader);
			}

			const result = await response.json();
			
			// Log stop impersonation
			const event = getRequestEvent();
			if (event) {
				await logAction(locals, event, {
					action: 'user.stop-impersonate',
					resourceType: 'user',
					method: 'POST',
					path: '/api/auth/admin/stop-impersonating',
					metadata: { impersonationType: 'user' }
				});
			}
			
			return { success: true, data: result };
		} else {
			// Handle team/company impersonation - clear cookies and reset session context
			const impersonationType = cookies.get('impersonated_type') as 'team' | 'company' | null;
			const impersonationId = cookies.get('impersonated_id');
			
			cookies.delete('impersonated_type', { path: '/' });
			cookies.delete('impersonated_id', { path: '/' });
			cookies.delete('impersonated_by', { path: '/' });
			cookies.delete('impersonated_user_id', { path: '/' }); // Backward compatibility
			
			// Clear team/company context from session
			if (locals.sessionId) {
				const { setSessionTeam, setSessionCompany } = await import('$lib/server/auth/session');
				await setSessionTeam(locals.sessionId, null);
				await setSessionCompany(locals.sessionId, null);
			}
			
			// Log stop impersonation
			const event = getRequestEvent();
			if (event) {
				await logAction(locals, event, {
					action: 'context.stop-impersonate',
					resourceType: impersonationType || undefined,
					resourceId: impersonationId || undefined,
					method: 'POST',
					path: '/layout.remote/stopImpersonating',
					metadata: { impersonationType }
				});
			}
			
			return { success: true, data: { message: 'Impersonation stopped' } };
		}
	} catch (error: any) {
		// Log failed stop impersonation
		const event = getRequestEvent();
		if (event) {
			await logAction(locals, event, {
				action: 'user.stop-impersonate',
				method: 'POST',
				path: '/layout.remote/stopImpersonating',
				success: false,
				errorMessage: error.message || 'Failed to stop impersonating'
			});
		}
		
		return { success: false, message: error.message || 'Failed to stop impersonating' };
	}
});

export const switchTeam = command('unchecked', async ({ teamId }: { teamId: string }) => {
	const { locals, request } = getRequestEvent();
	
	// Get session from Better Auth to ensure we have the correct session ID
	const { auth } = await import('$lib/server/auth/better-auth');
	const session = await auth.api.getSession({
		headers: request.headers
	});
	
	if (!session) {
		return { success: false, message: 'Unauthorized' };
	}
	
	const sessionId = session.session.id;
	
	if (!locals.user || !sessionId) {
		return { success: false, message: 'Unauthorized' };
	}

	const { setSessionTeam, setSessionCompany } = await import('$lib/server/auth/session');
	const { isGod } = await import('$lib/server/auth/permissions');
	const { db } = await import('$lib/server/db/client');
	const { teams, teamMembers } = await import('$lib/server/db/schema');
	const { eq, and } = await import('drizzle-orm');

	const isGodUser = await isGod(locals.user.id);

	// Allow clearing team for god users
	if (!teamId || teamId === '') {
		if (isGodUser) {
			try {
				await setSessionTeam(sessionId, null);
				// Also clear company context when clearing team
				await setSessionCompany(sessionId, null);
				
				// Log context switch
				const event = getRequestEvent();
				if (event) {
					await logAction(locals, event, {
						action: 'context.switch-team',
						resourceType: 'team',
						method: 'POST',
						path: '/layout.remote/switchTeam',
						metadata: { teamId: null, action: 'clear' }
					});
				}
				
				return { success: true };
			} catch (err: any) {
				// Log failed action
				const event = getRequestEvent();
				if (event) {
					await logAction(locals, event, {
						action: 'context.switch-team',
						resourceType: 'team',
						method: 'POST',
						path: '/layout.remote/switchTeam',
						success: false,
						errorMessage: err.message || 'Failed to clear team',
						metadata: { teamId: null, action: 'clear' }
					});
				}
				
				return { success: false, message: 'Failed to clear team' };
			}
		} else {
			return { success: false, message: 'Team is required' };
		}
	}

	// Verify user has access to team
	if (isGodUser) {
		// God users can switch to any team
		const team = await db.query.teams.findFirst({
			where: eq(teams.id, teamId)
		});

		if (!team) {
			return { success: false, message: 'Team not found' };
		}
	} else {
		// Regular users must be members of the team
		const membership = await db.query.teamMembers.findFirst({
			where: and(
				eq(teamMembers.teamId, teamId),
				eq(teamMembers.userId, locals.user.id)
			)
		});

		if (!membership) {
			return { success: false, message: 'You do not have access to this team' };
		}
	}

	try {
		await setSessionTeam(sessionId, teamId);
		// Clear company context when switching to a team
		await setSessionCompany(sessionId, null);
		
		// Log context switch
		const event = getRequestEvent();
		if (event) {
			await logAction(locals, event, {
				action: 'context.switch-team',
				resourceType: 'team',
				resourceId: teamId,
				method: 'POST',
				path: '/layout.remote/switchTeam',
				metadata: { teamId }
			});
		}
		
		return { success: true };
	} catch (err: any) {
		// Log failed action
		const event = getRequestEvent();
		if (event) {
			await logAction(locals, event, {
				action: 'context.switch-team',
				resourceType: 'team',
				resourceId: teamId,
				method: 'POST',
				path: '/layout.remote/switchTeam',
				success: false,
				errorMessage: err.message || 'Failed to switch team',
				metadata: { teamId }
			});
		}
		
		return { success: false, message: 'Failed to switch team' };
	}
});

export const switchCompany = command('unchecked', async ({ companyId }: { companyId: string }) => {
	const { locals, request } = getRequestEvent();
	
	// Get session from Better Auth to ensure we have the correct session ID
	const { auth } = await import('$lib/server/auth/better-auth');
	const session = await auth.api.getSession({
		headers: request.headers
	});
	
	if (!session) {
		return { success: false, message: 'Unauthorized' };
	}
	
	const sessionId = session.session.id;
	
	if (!locals.user || !sessionId) {
		return { success: false, message: 'Unauthorized' };
	}

	const { setSessionCompany, setSessionTeam } = await import('$lib/server/auth/session');
	const { isGod } = await import('$lib/server/auth/permissions');
	const { db } = await import('$lib/server/db/client');
	const { companies } = await import('$lib/server/db/schema');
	const { eq } = await import('drizzle-orm');

	const isGodUser = await isGod(locals.user.id);

	// Only God users can switch company context
	if (!isGodUser) {
		return { success: false, message: 'Unauthorized' };
	}

	// Allow clearing company context
	if (!companyId || companyId === '') {
		try {
			await setSessionCompany(sessionId, null);
			// Also clear team context when clearing company
			await setSessionTeam(sessionId, null);
			
			// Log context switch
			const event = getRequestEvent();
			if (event) {
				await logAction(locals, event, {
					action: 'context.switch-company',
					resourceType: 'company',
					method: 'POST',
					path: '/layout.remote/switchCompany',
					metadata: { companyId: null, action: 'clear' }
				});
			}
			
			return { success: true };
		} catch (err: any) {
			// Log failed action
			const event = getRequestEvent();
			if (event) {
				await logAction(locals, event, {
					action: 'context.switch-company',
					resourceType: 'company',
					method: 'POST',
					path: '/layout.remote/switchCompany',
					success: false,
					errorMessage: err.message || 'Failed to clear company',
					metadata: { companyId: null, action: 'clear' }
				});
			}
			
			return { success: false, message: 'Failed to clear company' };
		}
	}

	// Verify company exists
	const company = await db.query.companies.findFirst({
		where: eq(companies.id, companyId)
	});

	if (!company) {
		return { success: false, message: 'Company not found' };
	}

	try {
		await setSessionCompany(sessionId, companyId);
		// Clear team context when switching to a company
		await setSessionTeam(sessionId, null);
		
		// Log context switch
		const event = getRequestEvent();
		if (event) {
			await logAction(locals, event, {
				action: 'context.switch-company',
				resourceType: 'company',
				resourceId: companyId,
				method: 'POST',
				path: '/layout.remote/switchCompany',
				metadata: { companyId }
			});
		}
		
		return { success: true };
	} catch (err: any) {
		// Log failed action
		const event = getRequestEvent();
		if (event) {
			await logAction(locals, event, {
				action: 'context.switch-company',
				resourceType: 'company',
				resourceId: companyId,
				method: 'POST',
				path: '/layout.remote/switchCompany',
				success: false,
				errorMessage: err.message || 'Failed to switch company',
				metadata: { companyId }
			});
		}
		
		return { success: false, message: 'Failed to switch company' };
	}
});
