import type { Plugin } from 'vite';

/**
 * Vite plugin to handle agent websocket connections in development
 */
export function agentWebSocketPlugin(): Plugin {
    return {
        name: 'agent-websocket',
        apply: 'serve',
        async configureServer(server) {
            if (!server.httpServer) return;

            // Dynamic import to avoid build-time issues
            const { WebSocketServer } = await import('ws');

            const wss = new WebSocketServer({ 
                noServer: true,
                path: '/api/agent'
            });

            server.httpServer.on('upgrade', (request, socket, head) => {
                const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
                // Accept WebSocket upgrades on /api/agent OR if agent headers are present
                // (Cloudflare tunnel may strip the path)
                const hasAgentHeaders = request.headers['x-selfhost-agent-id'] && request.headers['x-selfhost-agent-key'];
                
                if (pathname === '/api/agent' || hasAgentHeaders) {
                    wss.handleUpgrade(request, socket, head, (ws) => {
                        wss.emit('connection', ws, request);
                    });
                }
            });

            wss.on('connection', async (ws, request) => {
                const agentId = request.headers['x-selfhost-agent-id'] as string;
                const agentKey = request.headers['x-selfhost-agent-key'] as string;

                if (!agentId || !agentKey) {
                    console.error('[WS] Missing agent headers');
                    ws.close(4000, "Missing credentials");
                    return;
                }

                // Lazy load manager to avoid loading DB at config time
                const { agentManager } = await import(/* @vite-ignore */ './src/lib/server/agent/manager');

                try {
                    const conn = await agentManager.register(ws as any, agentId, agentKey);
                    if (!conn) return;

                    ws.on('message', (data) => {
                        try {
                            const message = JSON.parse(data.toString());
                            agentManager.handleMessage(agentId, message);
                        } catch (err) {
                            console.error(`[WS] Failed to parse message from ${agentId}`);
                        }
                    });

                    ws.on('close', () => {
                        agentManager.unregister(agentId);
                    });

                    ws.on('error', (err) => {
                        console.error(`[WS] Error for agent ${agentId}:`, err);
                        agentManager.unregister(agentId);
                    });

                } catch (err) {
                    console.error(`[WS] Registration failed:`, err);
                    ws.close(4002, "Registration error");
                }
            });
        }
    };
}
