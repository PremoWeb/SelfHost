import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sources, applications } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { verifyGitHubSignature } from '$lib/server/utils/github';
import { addWebhookEvent } from '$lib/server/services/webhook-events';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    const signature = request.headers.get('x-hub-signature-256');
    const event = request.headers.get('x-github-event');
    const delivery = request.headers.get('x-github-delivery');
    
    await addWebhookEvent({
        event,
        delivery,
        hasSignature: !!signature
    });

    try {
        // Get raw body for signature verification
        const rawBody = await request.text();
        const payload = JSON.parse(rawBody);
        
        // Handle installation events (when app is installed/updated)
        if (event === 'installation' || event === 'installation_repositories') {
            const installationId = payload.installation?.id;
            const appId = payload.installation?.app_id;
            
            if (installationId && appId) {
                // Find source by app_id
                const [source] = await db
                    .select()
                    .from(sources)
                    .where(eq(sources.appId, appId.toString()))
                    .limit(1);

                if (source) {
                    // Update installation ID if not set
                    if (!source.installationId) {
                        await db
                            .update(sources)
                            .set({ installationId: installationId.toString() })
                            .where(eq(sources.id, source.id));
                    }
                    
                    await addWebhookEvent({
                        action: payload.action,
                        source: source.name,
                        installationId,
                        repositories: payload.repositories?.length || 0
                    });
                }
            }
            
            return json({ received: true });
        }
        
        // Handle ping event (sent when webhook is first created)
        if (event === 'ping') {
            
            // Store installation ID if we have it
            const installationId = payload.hook?.app_id;
            const appId = payload.hook?.app_id;
            
            if (installationId && appId) {
                // Find the source by app_id and update installation_id
                const [source] = await db
                    .select()
                    .from(sources)
                    .where(eq(sources.appId, appId.toString()))
                    .limit(1);

                if (source && !source.installationId) {
                    await db
                        .update(sources)
                        .set({ installationId: payload.installation?.id?.toString() || installationId.toString() })
                        .where(eq(sources.id, source.id));
                }
            }
            
            return json({ message: 'pong' });
        }
        
        // Find the source by installation ID or app ID
        // GitHub sends installation.id in the payload
        const installationId = payload.installation?.id;
        
        if (!installationId) {
            return json({ error: 'No installation ID' }, { status: 400 });
        }

        // Find source by installation ID
        const [source] = await db
            .select()
            .from(sources)
            .where(eq(sources.installationId, installationId.toString()))
            .limit(1);

        if (!source) {
            // Still return 200 to avoid GitHub retrying
            return json({ received: true });
        }

        // TODO: Validate webhook signature using source.webhookSecret
        
        // Route to appropriate handler based on event type
        switch (event) {
            case 'push':
                await handlePushEvent(payload, source);
                break;
            case 'pull_request':
                await handlePullRequestEvent(payload, source);
                break;
            default:
        }
        
        return json({ received: true });
    } catch (error: any) {
        return json({ error: 'Failed to process webhook' }, { status: 500 });
    }
};

async function handlePushEvent(payload: any, source: any) {
    const repo = payload.repository.full_name;
    const branch = payload.ref.replace('refs/heads/', '');
    const commit = payload.after;
    const commitMessage = payload.head_commit?.message || '';
    
    await addWebhookEvent({
        repo,
        branch,
        commit: commit.substring(0, 7),
        message: commitMessage.split('\n')[0],
        source: source.name
    });
    
    // Broadcast event to connected clients
    addWebhookEvent({
        type: 'push',
        repo,
        branch,
        commit: commit.substring(0, 7),
        commitMessage: commitMessage.split('\n')[0],
        author: payload.head_commit?.author?.name || 'Unknown',
        timestamp: new Date().toISOString(),
        sourceName: source.name,
        teamId: source.teamId
    });
    
    // TODO: Find applications that match this repo and branch
    // TODO: Trigger deployment
}

async function handlePullRequestEvent(payload: any, source: any) {
    const action = payload.action;
    const pr = payload.pull_request;
    
    await addWebhookEvent({
        action,
        number: pr.number,
        title: pr.title,
        branch: pr.head.ref,
        source: source.name
    });
    
    // TODO: Handle PR preview deployments
}
