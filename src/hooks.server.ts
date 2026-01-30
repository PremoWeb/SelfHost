import { sequence } from '@sveltejs/kit/hooks';
import { dev, building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db/client';
import { teams, sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { initializeDatabase } from '$lib/server/db/init';
import { startTunnel, stopTunnel } from '$lib/server/services/tunnel';
import { auth } from '$lib/server/auth/better-auth';
import { getUserCurrentTeam } from '$lib/server/auth/session';
import { isGod } from '$lib/server/auth/permissions';
import { handleImpersonation } from '$lib/server/auth/impersonation';
import type { Handle, ServerInit } from '@sveltejs/kit';

/**
 * 1. Installer Middleware: Redirect curl users to the installer page
 */
const installerMiddleware: Handle = async ({ event, resolve }) => {
	const userAgent = event.request.headers.get('user-agent') || '';
	const isCurl = userAgent.toLowerCase().includes('curl');

	if (isCurl && event.url.pathname === '/') {
		const { redirect } = await import('@sveltejs/kit');
		throw redirect(302, '/installer');
	}

	return resolve(event);
};

/**
 * 2. Website Mode Middleware: Enforce private mode if enabled
 */
const websiteModeMiddleware: Handle = async ({ event, resolve }) => {
	const { getInstanceSettings } = await import('$lib/server/services/settings');
	const settings = await getInstanceSettings();
	const websiteMode = settings?.websiteMode || false;

	if (!websiteMode) return resolve(event);

	// Whitelist public routes
	const publicRoutes = ['/', '/docs', '/sponsors', '/login', '/register', '/api/auth', '/landing', '/installer'];
	const isPublicRoute = publicRoutes.some((route) => event.url.pathname.startsWith(route));

	if (isPublicRoute) return resolve(event);

	const session = await auth.api.getSession({ headers: event.request.headers });
	if (!session) {
		const { redirect } = await import('@sveltejs/kit');
		throw redirect(303, '/');
	}

	return resolve(event);
};

/**
 * 3. Auth & Context Middleware: Resolve user, session, team, and impersonation
 */
const authContextMiddleware: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		// Set basic session info
		event.locals.sessionId = session.session.id;

		// Handle Impersonation
		const imp = await handleImpersonation(event, session);
		if (imp) {
			event.locals.user = imp.user;
			event.locals.impersonatedBy = imp.impersonatedBy;
			event.locals.isImpersonating = imp.isImpersonating;
			event.locals.impersonationType = imp.impersonationType;
			event.locals.impersonationEntity = imp.impersonationEntity;
			event.locals.forceTeamId = imp.forceTeamId;
			event.locals.forceCompanyId = imp.forceCompanyId;
		} else {
			// Normal User context
			event.locals.user = {
				...session.user,
				image: session.user.image ?? null,
				isGod: (session.user as any).isGod ?? false
			};
			event.locals.isImpersonating = false;
			event.locals.impersonatedBy = null;
		}

		// Resolve Session from DB (for custom fields)
		const [dbSession] = await db.select().from(sessions).where(eq(sessions.id, session.session.id)).limit(1);
		event.locals.session = {
			...session.session,
			ipAddress: session.session.ipAddress ?? null,
			userAgent: session.session.userAgent ?? null,
			activeTeamId: dbSession?.activeTeamId ?? null,
			activeCompanyId: dbSession?.activeCompanyId ?? null,
			impersonatedBy: (session.session as any).impersonatedBy ?? dbSession?.impersonatedBy ?? null
		};

		// Resolve Team/Company Context
		const user = event.locals.user;
		if (!user) return resolve(event);

		const userId = user.id;
		const activeTeamId = dbSession?.activeTeamId ?? null;
		const activeCompanyId = dbSession?.activeCompanyId ?? null;

		if (event.locals.isImpersonating && event.locals.impersonationType === 'team' && event.locals.forceTeamId) {
			const [team] = await db.select().from(teams).where(eq(teams.id, event.locals.forceTeamId)).limit(1);
			event.locals.team = team;
			event.locals.activeCompanyId = null;
		} else if (event.locals.isImpersonating && event.locals.impersonationType === 'company' && event.locals.forceCompanyId) {
			event.locals.team = null;
			event.locals.activeCompanyId = event.locals.forceCompanyId;
		} else if (activeCompanyId) {
			event.locals.team = null;
			event.locals.activeCompanyId = activeCompanyId;
		} else if (activeTeamId) {
			const isGodUser = await isGod(userId);
			let team;
			if (isGodUser) {
				const [teamResult] = await db.select().from(teams).where(eq(teams.id, activeTeamId)).limit(1);
				team = teamResult || null;
			} else {
				team = await getUserCurrentTeam(userId, activeTeamId);
			}
			event.locals.team = team;
			event.locals.activeCompanyId = null;
		} else {
			// No active team in session: god users get team=null (see all servers); others get default team
			const isGodUser = await isGod(userId);
			event.locals.team = isGodUser ? null : await getUserCurrentTeam(userId, null);
			event.locals.activeCompanyId = null;
		}
	}

	return resolve(event);
};

/**
 * 4. Performance Logger Middleware
 */
const performanceMiddleware: Handle = async ({ event, resolve }) => {
	const start = performance.now();
	const response = await resolve(event);
	const duration = performance.now() - start;

	if (duration > 100) {
		console.log(`🐢 Slow resolution for ${event.url.pathname}: ${duration.toFixed(2)}ms`);
	}

	return response;
};

// Combine all handles in sequence
export const handle = sequence(
	installerMiddleware,
	websiteModeMiddleware,
	authContextMiddleware,
	performanceMiddleware
);

/**
 * Server Lifecycle initialization
 */
export const init: ServerInit = async () => {
	const start = performance.now();
	console.log('🚀 Server starting initialization...');

	if (!building) {
		try {
			console.log('📦 Starting database initialization...');
			await initializeDatabase();
			console.log('✅ Database initialization finished.');
		} catch (error) {
			console.error('❌ Failed to initialize database during startup:', error);
		}
	}

	// Async initialization (don't block startup)
	console.log('📝 Initializing logging database (async)...');
	import('$lib/server/db/init-logging').then((m) => m.initializeLoggingDatabase()).catch(() => {});

	if (dev && !env.SKIP_TUNNEL) {
		console.log('🌐 Starting Cloudflare tunnel...');
		startTunnel()
			.then((url) => console.log(`🌍 Tunnel started at: ${url}`))
			.catch((err) => console.error('❌ Tunnel failed to start:', err.message));

		process.on('SIGINT', async () => {
			await stopTunnel();
			process.exit();
		});
		process.on('SIGTERM', async () => {
			await stopTunnel();
			process.exit();
		});
	}

	console.log(`✨ Server initialization finished in ${(performance.now() - start).toFixed(2)}ms`);
};
