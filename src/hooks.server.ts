import type { Handle } from '@sveltejs/kit';
import { auth } from '$lib/server/auth/better-auth';
import { getUserCurrentTeam } from '$lib/server/auth/session';
import { getInstanceSettings } from '$lib/server/services/settings';
import { db } from '$lib/server/db/client';
import { teams, sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { initializeLoggingDatabase } from '$lib/server/db/init-logging';

export const handle: Handle = async ({ event, resolve }) => {
	// Check website mode and public route whitelist
	const settings = await getInstanceSettings();
	const websiteMode = settings?.websiteMode || false;
	
	// Public route whitelist (accessible without authentication in website mode)
	const publicRoutes = ['/', '/docs', '/sponsors', '/login', '/register', '/api/auth', '/landing'];
	const isPublicRoute = publicRoutes.some(route => event.url.pathname.startsWith(route));
	
	// Get session first to check if user is authenticated
	const session = await auth.api.getSession({
		headers: event.request.headers
	});
	
	// If website mode is enabled and user is NOT authenticated
	if (websiteMode && !session) {
		// Allow access to public routes
		// The root "/" will be handled by (public) route group when website mode is on
		if (isPublicRoute || event.url.pathname === '/') {
			// Continue without setting user session for public routes
			// Don't set locals.user - let the route handle it
			return resolve(event);
		}
		// For non-public routes that aren't "/", redirect to "/" (which will show landing)
		const { redirect } = await import('@sveltejs/kit');
		throw redirect(303, '/');
	}
	
	// If website mode is enabled and user IS authenticated, they can access all routes normally
	// The (app) layout will handle authentication requirements

	if (session) {
		// Check for Better Auth's built-in user impersonation (from admin plugin)
		const betterAuthImpersonatedBy = (session.session as any).impersonatedBy;
		
		// Check for custom team/company impersonation (new format: type + id, or old format: user_id for backward compatibility)
		const impersonatedType = event.cookies.get('impersonated_type') as 'user' | 'team' | 'company' | null;
		const impersonatedId = event.cookies.get('impersonated_id');
		const impersonatedUserId = event.cookies.get('impersonated_user_id'); // Backward compatibility
		const impersonatedBy = event.cookies.get('impersonated_by');

		// Handle Better Auth's built-in user impersonation first
		if (betterAuthImpersonatedBy) {
			const { isGod } = await import('$lib/server/auth/permissions');
			const { getUserById } = await import('$lib/server/auth/session');
			
			// Verify the original user is God
			const originalUser = await getUserById(betterAuthImpersonatedBy);
			if (originalUser && await isGod(originalUser.id)) {
				// Better Auth handles user impersonation - session.user is already the impersonated user
				event.locals.user = {
					...session.user,
					image: session.user.image ?? null,
					isGod: (session.user as any).isGod ?? false
				};
				event.locals.impersonatedBy = originalUser;
				event.locals.isImpersonating = true;
				event.locals.impersonationType = 'user';
				event.locals.impersonationEntity = session.user;
			} else {
				// Invalid impersonation - Better Auth should handle this, but clear it just in case
				event.locals.user = {
					...session.user,
					image: session.user.image ?? null,
					isGod: (session.user as any).isGod ?? false
				};
			}
		}
		// Handle custom team/company impersonation (only if Better Auth isn't handling user impersonation)
		else if ((impersonatedType && impersonatedId && impersonatedBy && impersonatedType !== 'user') || (impersonatedUserId && impersonatedBy)) {
			const { isGod } = await import('$lib/server/auth/permissions');
			const { getUserById } = await import('$lib/server/auth/session');
			const { db } = await import('$lib/server/db/client');
			const { teams, companies } = await import('$lib/server/db/schema');
			const { eq } = await import('drizzle-orm');
			
			// Verify the original user is God
			const originalUser = await getUserById(impersonatedBy);
			if (originalUser && await isGod(originalUser.id)) {
				// Handle new format (type + id) - only team/company now (user is handled by Better Auth)
				if (impersonatedType && impersonatedId) {
					if (impersonatedType === 'team') {
						// Impersonate a team - set team context and keep God user
						const [team] = await db.select().from(teams).where(eq(teams.id, impersonatedId)).limit(1);
						if (team) {
							event.locals.user = {
								...session.user,
								image: session.user.image ?? null,
								isGod: (session.user as any).isGod ?? false
							};
							// Force team context
							event.locals.impersonatedBy = originalUser;
							event.locals.isImpersonating = true;
							event.locals.impersonationType = 'team';
							event.locals.impersonationEntity = team;
							// Set team in session for this request (will be persisted)
							event.locals.forceTeamId = team.id;
							// Also update session immediately
							const { setSessionTeam, setSessionCompany } = await import('$lib/server/auth/session');
							await setSessionTeam(session.session.id, team.id);
							await setSessionCompany(session.session.id, null);
						} else {
							// Invalid, clear cookies
							event.cookies.delete('impersonated_type', { path: '/' });
							event.cookies.delete('impersonated_id', { path: '/' });
							event.cookies.delete('impersonated_by', { path: '/' });
							event.locals.user = {
								...session.user,
								image: session.user.image ?? null,
								isGod: (session.user as any).isGod ?? false
							};
						}
					} else if (impersonatedType === 'company') {
						// Impersonate a company - set company context and keep God user
						const [company] = await db.select().from(companies).where(eq(companies.id, impersonatedId)).limit(1);
						if (company) {
							event.locals.user = {
								...session.user,
								image: session.user.image ?? null,
								isGod: (session.user as any).isGod ?? false
							};
							// Force company context
							event.locals.impersonatedBy = originalUser;
							event.locals.isImpersonating = true;
							event.locals.impersonationType = 'company';
							event.locals.impersonationEntity = company;
							// Set company in session for this request (will be persisted)
							event.locals.forceCompanyId = company.id;
							// Also update session immediately
							const { setSessionCompany, setSessionTeam } = await import('$lib/server/auth/session');
							await setSessionCompany(session.session.id, company.id);
							await setSessionTeam(session.session.id, null);
						} else {
							// Invalid, clear cookies
							event.cookies.delete('impersonated_type', { path: '/' });
							event.cookies.delete('impersonated_id', { path: '/' });
							event.cookies.delete('impersonated_by', { path: '/' });
							event.locals.user = {
								...session.user,
								image: session.user.image ?? null,
								isGod: (session.user as any).isGod ?? false
							};
						}
					}
				} else if (impersonatedUserId) {
					// Backward compatibility: old format (user impersonation)
					const impersonatedUser = await getUserById(impersonatedUserId);
					if (impersonatedUser) {
						event.locals.user = {
							...impersonatedUser,
							image: impersonatedUser.image ?? null,
							isGod: impersonatedUser.isGod ?? false
						};
						event.locals.impersonatedBy = originalUser;
						event.locals.isImpersonating = true;
						event.locals.impersonationType = 'user';
						event.locals.impersonationEntity = impersonatedUser;
					} else {
						// Invalid, clear cookies
						event.cookies.delete('impersonated_user_id', { path: '/' });
						event.cookies.delete('impersonated_by', { path: '/' });
						event.locals.user = {
							...session.user,
							image: session.user.image ?? null,
							isGod: (session.user as any).isGod ?? false
						};
					}
				} else {
					// Invalid, clear cookies
					event.cookies.delete('impersonated_type', { path: '/' });
					event.cookies.delete('impersonated_id', { path: '/' });
					event.cookies.delete('impersonated_user_id', { path: '/' });
					event.cookies.delete('impersonated_by', { path: '/' });
					event.locals.user = {
						...session.user,
						image: session.user.image ?? null,
						isGod: (session.user as any).isGod ?? false
					};
				}
			} else {
				// Invalid impersonation, clear cookies
				event.cookies.delete('impersonated_type', { path: '/' });
				event.cookies.delete('impersonated_id', { path: '/' });
				event.cookies.delete('impersonated_user_id', { path: '/' });
				event.cookies.delete('impersonated_by', { path: '/' });
				// Fall through to normal session
				event.locals.user = {
					...session.user,
					image: session.user.image ?? null,
					isGod: (session.user as any).isGod ?? false
				};
			}
		} else {
			// Normal session, no impersonation
			event.locals.user = {
				...session.user,
				image: session.user.image ?? null,
				isGod: (session.user as any).isGod ?? false
			};
			// Explicitly set impersonation flags to false/null
			event.locals.isImpersonating = false;
			event.locals.impersonationType = undefined as 'user' | 'team' | 'company' | undefined;
			event.locals.impersonatedBy = null;
			event.locals.impersonationEntity = null;
		}

		event.locals.sessionId = session.session.id;
		
		// Query session directly from database to get custom fields (activeTeamId, activeCompanyId)
		// Better Auth's getSession might not return these custom fields
		const [dbSession] = await db.select().from(sessions).where(eq(sessions.id, session.session.id)).limit(1);
		
		event.locals.session = {
			...session.session,
			ipAddress: session.session.ipAddress ?? null,
			userAgent: session.session.userAgent ?? null,
			activeTeamId: dbSession?.activeTeamId ?? null,
			activeCompanyId: dbSession?.activeCompanyId ?? null,
			impersonatedBy: (session.session as any).impersonatedBy ?? dbSession?.impersonatedBy ?? null
		};
        
        // Custom Team/Company Logic
        // Get activeTeamId and activeCompanyId from the database session
        const activeTeamId = dbSession?.activeTeamId ?? null;
        const activeCompanyId = dbSession?.activeCompanyId ?? null;
        const userId = event.locals.user?.id || session.user.id;
        
		// Handle impersonation context (team or company)
		if (event.locals.isImpersonating && event.locals.impersonationType === 'team' && event.locals.forceTeamId) {
			// When impersonating a team, force that team context
			// Only query if we don't already have it cached
			if (!event.locals.team || event.locals.team.id !== event.locals.forceTeamId) {
				const [team] = await db.select().from(teams).where(eq(teams.id, event.locals.forceTeamId)).limit(1);
				event.locals.team = team;
			}
			event.locals.activeCompanyId = null;
		} else if (event.locals.isImpersonating && event.locals.impersonationType === 'company' && event.locals.forceCompanyId) {
			// When impersonating a company, force that company context
			event.locals.team = null;
			event.locals.activeCompanyId = event.locals.forceCompanyId;
		} else if (activeCompanyId) {
			// Normal company context (not impersonation)
			event.locals.team = null;
			event.locals.activeCompanyId = activeCompanyId;
		} else if (activeTeamId) {
			// If we have a team ID in session, try to use it directly (avoid query if possible)
			// Only query if we don't already have the team
			if (!event.locals.team || event.locals.team.id !== activeTeamId) {
				// For God users, query the team directly (they may not be members)
				// For regular users, use getUserCurrentTeam which checks membership
				const { isGod } = await import('$lib/server/auth/permissions');
				const isGodUser = await isGod(userId);
				
				let team;
				if (isGodUser) {
					// God users can access any team, query directly
					const [teamResult] = await db.select().from(teams).where(eq(teams.id, activeTeamId)).limit(1);
					team = teamResult || null;
				} else {
					// Regular users must be members
					team = await getUserCurrentTeam(userId, activeTeamId);
				}
				
				event.locals.team = team;
			}
			event.locals.activeCompanyId = null;
		} else {
			// No team in session, get user's current team
			const team = await getUserCurrentTeam(userId, null);
			event.locals.team = team;
			event.locals.activeCompanyId = null;
		}
	}

	return resolve(event);
};

import { dev, building } from '$app/environment';
import { startTunnel, stopTunnel } from '$lib/server/services/tunnel';
import { initializeDatabase } from '$lib/server/db/init';
import type { ServerInit } from '@sveltejs/kit';

export const init: ServerInit = async () => {
	// Initialize database first (migrations, schema setup, etc.)
	if (!building) {
		try {
			await initializeDatabase();
		} catch (error) {
			// Don't throw - allow server to start even if DB init fails
			// The error will be logged and can be handled by the application
		}
	}

	// Initialize logging database (always, not just in dev)
	initializeLoggingDatabase().catch(() => {
		// Silently fail - logging failures shouldn't break the app
	});

	// Initialize development tunnel if in dev mode
	if (dev && !process.env.SKIP_TUNNEL) {
		// Auto-start tunnel in development
		startTunnel().catch(() => {
			// Silently fail - tunnel failures shouldn't break the app
		});

		// Cleanup on exit
		process.on('SIGINT', async () => {
			await stopTunnel();
			process.exit();
		});
		process.on('SIGTERM', async () => {
			await stopTunnel();
			process.exit();
		});
	}
};
