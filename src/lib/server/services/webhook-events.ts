// Store for recent webhook events (in-memory, use Redis in production)
const recentEvents: any[] = [];
const MAX_EVENTS = 50;

// SSE connections
const connections = new Set<ReadableStreamDefaultController>();

export function addWebhookEvent(event: any) {
    recentEvents.unshift(event);
    if (recentEvents.length > MAX_EVENTS) {
        recentEvents.pop();
    }
    
    // Broadcast to all connected clients
    broadcastEvent(event);
}

function broadcastEvent(event: any) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    connections.forEach(controller => {
        try {
            controller.enqueue(new TextEncoder().encode(data));
        } catch (e) {
            // Connection closed, will be cleaned up
        }
    });
}

export function addConnection(controller: ReadableStreamDefaultController, teamId: string) {
    connections.add(controller);
    
    // Send initial events for this team
    const teamEvents = recentEvents.filter(e => e.teamId === teamId);
    teamEvents.forEach(event => {
        try {
            controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
            );
        } catch (e) {
            // Connection closed
        }
    });
}

export function removeConnection(controller: ReadableStreamDefaultController) {
    connections.delete(controller);
}

export function getRecentEvents(teamId: string) {
    return recentEvents.filter(e => e.teamId === teamId);
}
