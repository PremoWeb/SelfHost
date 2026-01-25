import { addConnection, removeConnection } from '$lib/server/services/webhook-events';
import { requireApiAuth, isGod } from '$lib/server/auth/permissions';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
    // Check authentication - return SSE error message instead of JSON
    if (!locals.user) {
        const errorStream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"error": "Unauthorized"}\n\n'));
                controller.close();
            }
        });
        
        return new Response(errorStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    }
    
    // Check authorization
    const { isAuthorized } = await import('$lib/server/auth/permissions');
    if (!(await isAuthorized(locals.user.id, locals.team?.id))) {
        const errorStream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"error": "Unauthorized"}\n\n'));
                controller.close();
            }
        });
        
        return new Response(errorStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    }
    
    // God users can access this but need a team for webhook events
    // For now, return empty stream if no team
    if (!locals.team && !(await isGod(locals.user.id))) {
        const errorStream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"error": "Team required"}\n\n'));
                controller.close();
            }
        });
        
        return new Response(errorStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    }
    
    // If no team (god user), return empty stream
    if (!locals.team) {
        const emptyStream = new ReadableStream({
            start(controller) {
                // Send initial connection message
                controller.enqueue(new TextEncoder().encode('data: {"message": "No active team"}\n\n'));
                // Keep connection alive with periodic pings
                const pingInterval = setInterval(() => {
                    try {
                        controller.enqueue(new TextEncoder().encode(': ping\n\n'));
                    } catch (e) {
                        clearInterval(pingInterval);
                    }
                }, 30000);
                
                return () => {
                    clearInterval(pingInterval);
                };
            }
        });
        
        return new Response(emptyStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    }

    const stream = new ReadableStream({
        start(controller) {
            addConnection(controller, locals.team!.id);
            
            // Keep connection alive with periodic pings
            // Store interval ID on controller for cleanup if needed, or use a closure variable
            (controller as any).pingInterval = setInterval(() => {
                try {
                    controller.enqueue(new TextEncoder().encode(': ping\n\n'));
                } catch (e) {
                    clearInterval((controller as any).pingInterval);
                    removeConnection(controller);
                }
            }, 30000); // Every 30 seconds
        },
        cancel(controller) {
            clearInterval((controller as any).pingInterval);
            removeConnection(controller);
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    });
};
