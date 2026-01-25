import { db } from '../db/client';
import { servers } from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

interface AgentConnection {
    ws: WebSocket;
    id: string;
    hostname?: string;
    lastSeen: Date;
}

class AgentManager {
    private connections: Map<string, AgentConnection> = new Map();

    /**
     * Register a new connection
     */
    async register(ws: WebSocket, agentId: string, agentKey: string) {
        // Authenticate agent
        const [server] = await db
            .select()
            .from(servers)
            .where(eq(servers.id, agentId))
            .limit(1);

        if (!server || server.agentKey !== agentKey) {
            ws.close(4001, "Authentication failed");
            return;
        }

        
        const connection: AgentConnection = {
            ws,
            id: agentId,
            lastSeen: new Date()
        };

        this.connections.set(agentId, connection);

        // Update server status to online
        await db.update(servers).set({ status: 'online' }).where(eq(servers.id, agentId));

        return connection;
    }

    /**
     * Remove a connection
     */
    async unregister(agentId: string) {
        if (this.connections.has(agentId)) {
            this.connections.delete(agentId);
            
            // Update server status to offline
            await db.update(servers).set({ status: 'offline' }).where(eq(servers.id, agentId));
        }
    }

    /**
     * Send a command to an agent
     */
    async executeCommand(agentId: string, command: string) {
        const conn = this.connections.get(agentId);
        if (!conn) {
            await db.update(servers).set({ status: 'offline' }).where(eq(servers.id, agentId));
            throw new Error("Agent not connected");
        }

        const msgId = crypto.randomUUID();
        conn.ws.send(JSON.stringify({ 
            type: 'execute', 
            id: msgId, 
            payload: { command } 
        }));

        return msgId;
    }

    /**
     * Send a command and wait for result
     */
    async executeCommandWithResult(agentId: string, command: string, timeout = 10000): Promise<any> {
        const msgId = await this.executeCommand(agentId, command);
        
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingCommands.delete(msgId);
                reject(new Error("Command timed out"));
            }, timeout);

            this.pendingCommands.set(msgId, {
                resolve: (val) => {
                    clearTimeout(timer);
                    resolve(val);
                },
                reject: (err) => {
                    clearTimeout(timer);
                    reject(err);
                }
            });
        });
    }


    /**
     * Restart an agent
     */
    async restartAgent(agentId: string) {
        const conn = this.connections.get(agentId);
        if (!conn) {
            // Agent is not actually connected, update DB to reflect reality
            await db.update(servers).set({ status: 'offline' }).where(eq(servers.id, agentId));
            throw new Error("Agent not connected");
        }

        // Update status to restarting
        await db.update(servers).set({ status: 'restarting' }).where(eq(servers.id, agentId));

        const msgId = crypto.randomUUID();
        conn.ws.send(JSON.stringify({ 
            type: 'restart', 
            id: msgId, 
            payload: {} 
        }));

        return msgId;
    }

    /**
     * Reboot the server
     */
    async rebootServer(agentId: string, type: string = 'graceful') {
        const conn = this.connections.get(agentId);
        if (!conn) {
             await db.update(servers).set({ status: 'offline' }).where(eq(servers.id, agentId));
             throw new Error("Agent not connected");
        }

        const msgId = crypto.randomUUID();
        conn.ws.send(JSON.stringify({ 
            type: 'reboot', 
            id: msgId, 
            payload: { type } 
        }));

        return msgId;
    }

    /**
     * Get active connections
     */
    getConnections() {
        return Array.from(this.connections.values()).map(c => ({
            id: c.id,
            hostname: c.hostname,
            lastSeen: c.lastSeen
        }));
    }

    /**
     * Handle incoming messages from agents
     */
    private pendingCommands: Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void }> = new Map();

    /**
     * Handle incoming messages from agents
     */
    handleMessage(agentId: string, data: any) {
        const conn = this.connections.get(agentId);
        if (!conn) return;

        conn.lastSeen = new Date();
        
        if (data.type === 'hello') {
            conn.hostname = data.payload.hostname;
            // Update initial checksum
            this.updateHealthMetrics(agentId, { ...data.payload, checksum: data.payload.checksum }).catch(() => {
                // Silently fail - health metrics update errors shouldn't break the connection
            });
        } else if (data.type === 'health') {
            // Update health metrics in database
            this.updateHealthMetrics(agentId, data.payload).catch(() => {
                // Silently fail - health metrics update errors shouldn't break the connection
            });
        } else if (data.type === 'execute_result') {
             const pending = this.pendingCommands.get(data.id);
             if (pending) {
                 pending.resolve(data.payload);
                 this.pendingCommands.delete(data.id);
             }
        }

        // Here we could resolve promises for pending commands
    }

    private async updateHealthMetrics(agentId: string, health: any) {
        await db.update(servers)
            .set({
                status: 'online',
                healthCpu: health.cpu !== undefined ? Math.round(health.cpu * 100) : undefined,
                healthMemory: health.memory !== undefined ? Math.round(health.memory) : undefined,
                healthDisk: health.disk !== undefined ? Math.round(health.disk) : undefined,
                healthUpdatedAt: new Date(),
                proxyStatus: health.proxyStatus || 'stopped',
                ...(health.checksum && health.checksum !== 'unknown' ? { agentChecksum: health.checksum } : {}),
                ...(health.version && health.version !== 'dev' ? { agentVersion: health.version } : {}),
                ...(health.installedAt ? { agentInstalledAt: new Date(health.installedAt) } : {})
            })
            .where(eq(servers.id, agentId));
    }
    /**
     * Broadcast new service URL to all connected agents
     */
    async broadcastServiceUrlUpdate(newUrl: string) {
        const timestamp = Date.now();
        const wsUrl = newUrl.replace(/^http/, 'ws') + '/api/agent';

        // Iterate over all connected agents
        for (const [agentId, conn] of this.connections) {
            try {
                // Fetch server to get the signing key
                const [server] = await db
                    .select()
                    .from(servers)
                    .where(eq(servers.id, agentId))
                    .limit(1);

                if (!server || !server.agentKey) {
                    continue;
                }

                // Generate signature
                const payload = { url: wsUrl, timestamp };
                const hmac = crypto.createHmac('sha256', server.agentKey);
                hmac.update(JSON.stringify(payload));
                const signature = hmac.digest('hex');

                // Send update
                conn.ws.send(JSON.stringify({ 
                    type: 'update_url',
                    id: crypto.randomUUID(),
                    payload: { ...payload, signature }
                }));

            } catch (err) {
            }
        }
    }
}

// Singleton pattern to preserve state during HMR/Dev
const g = globalThis as any;
if (!g.__agentManager) {
    g.__agentManager = new AgentManager();
}
export const agentManager = g.__agentManager as AgentManager;
