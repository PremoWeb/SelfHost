import { spawn } from 'node:child_process';
import { dev } from '$app/environment';

// Singleton pattern for tunnel state to survive HMR
const g = globalThis as any;

if (!g.__tunnelState) {
    g.__tunnelState = {
        process: null,
        url: null
    };
}

export async function getTunnelUrl() {
    if (!dev) return null;
    return g.__tunnelState.url;
}

export async function stopTunnel() {
    if (g.__tunnelState.process) {
        g.__tunnelState.process.kill();
        g.__tunnelState.process = null;
        g.__tunnelState.url = null;
    }
}

export async function startTunnel(): Promise<string> {
    if (!dev) throw new Error('Tunnels are only available in development mode');
    if (g.__tunnelState.url) return g.__tunnelState.url;

    return new Promise((resolve, reject) => {
        try {
            // Start cloudflared quick tunnel
            g.__tunnelState.process = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:5173']);

            g.__tunnelState.process.stderr.on('data', (data: Buffer) => {
                const output = data.toString();
                // Look for the trycloudflare.com URL in the output
                const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
                if (match && !g.__tunnelState.url) {
                    g.__tunnelState.url = match[0];
                    
                    // Broadcast new URL to agents
                    import('../agent/manager').then(({ agentManager }) => {
                        agentManager.broadcastServiceUrlUpdate(g.__tunnelState.url!);
                    });

                    resolve(g.__tunnelState.url);
                }
            });

            g.__tunnelState.process.on('error', (err: any) => {
                reject(new Error('cloudflared not found or failed to start'));
            });

            g.__tunnelState.process.on('close', () => {
                g.__tunnelState.process = null;
                g.__tunnelState.url = null;
            });

            // Timeout if no URL found in 15s
            setTimeout(() => {
                if (!g.__tunnelState.url) {
                    stopTunnel();
                    reject(new Error('Tunnel startup timed out'));
                }
            }, 15000);

        } catch (err) {
            reject(err);
        }
    });
}
