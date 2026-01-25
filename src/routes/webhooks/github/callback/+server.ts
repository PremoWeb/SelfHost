import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sources } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { randomUUID } from 'node:crypto';

// Temporary in-memory storage for pending GitHub App registrations
// In production, use Redis or a database table with TTL
const pendingApps = new Map<string, { appData: any; expiresAt: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of pendingApps.entries()) {
        if (data.expiresAt < now) {
            pendingApps.delete(token);
        }
    }
}, 5 * 60 * 1000);

export const GET: RequestHandler = async ({ url, locals }) => {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    if (!code) {
        return new Response(null, {
            status: 302,
            headers: {
                'Location': 'http://localhost:5173/sources?error=no_code'
            }
        });
    }

    try {
        // Exchange the code for app credentials
        const response = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to convert manifest code');
        }

        const appData = await response.json();

        // If we have a session (localhost callback), store directly
        if (locals.team) {
            await db.insert(sources).values({
                name: appData.name,
                description: `GitHub App: ${appData.name}`,
                type: 'github',
                apiUrl: 'https://api.github.com',
                htmlUrl: appData.html_url,
                isApp: true,
                appId: appData.id.toString(),
                clientId: appData.client_id,
                clientSecret: appData.client_secret,
                privateKey: appData.pem,
                webhookSecret: appData.webhook_secret,
                teamId: locals.team.id
            });

            return new Response(null, {
                status: 302,
                headers: {
                    'Location': '/sources?github_app=success'
                }
            });
        }

        // No session (tunnel callback) - create a one-time token and redirect to localhost
        const token = randomUUID();
        pendingApps.set(token, {
            appData,
            expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
        });

        return new Response(null, {
            status: 302,
            headers: {
                'Location': `http://localhost:5173/github-app-complete?token=${token}`
            }
        });
    } catch (error: any) {
        return new Response(null, {
            status: 302,
            headers: {
                'Location': 'http://localhost:5173/sources?github_app=error'
            }
        });
    }
};

import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';

// Endpoint to complete the registration with the token
export const POST: RequestHandler = async ({ request, locals }) => {
    await requireApiAuth(locals);
    await requireTeam(locals);

    const { token } = await request.json();
    const pending = pendingApps.get(token);

    if (!pending || pending.expiresAt < Date.now()) {
        return json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    const { appData } = pending;
    pendingApps.delete(token);

    if (!locals.team) {
        return json({ error: 'Team required' }, { status: 400 });
    }

    const teamId = locals.team.id;

    // Store the GitHub App
    await db.insert(sources).values({
        name: appData.name,
        description: `GitHub App: ${appData.name}`,
        type: 'github',
        apiUrl: 'https://api.github.com',
        htmlUrl: appData.html_url,
        isApp: true,
        appId: appData.id.toString(),
        clientId: appData.client_id,
        clientSecret: appData.client_secret,
        privateKey: appData.pem,
        webhookSecret: appData.webhook_secret,
        teamId
    });

    return json({ success: true });
};
