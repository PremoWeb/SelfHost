import { spawn } from 'node:child_process';
import { db } from '../db/client';
import { cloudflareAccessTokens } from '../db/schema';
import { eq } from 'drizzle-orm';
import { bin as cloudflaredBin } from 'cloudflared';

/**
 * Service to handle Cloudflare Access Tunnel connections
 */
export class CloudflareAccessService {
    /**
     * Start a cloudflared access ssh connection as a duplex stream
     * This can be used as the 'sock' for ssh2 connection
     */
    static async getSshProxyStream(hostname: string, tokenId: string | null) {
        // Use 'access ssh' which is designed for ProxyCommand usage (stdio)
        const args = ['access', 'ssh', '--hostname', hostname];

        if (tokenId) {
            const [token] = await db
                .select()
                .from(cloudflareAccessTokens)
                .where(eq(cloudflareAccessTokens.id, tokenId))
                .limit(1);

            if (token) {
                args.push('--service-token-id', token.clientId);
                args.push('--service-token-secret', token.clientSecret);
            }
        }

        console.log(`Starting cloudflared [VERSION 2 - SSH] with args: ${args.join(' ')}`);
        console.log(`Using cloudflared binary at: ${cloudflaredBin}`);
        
        // Inherit environment variables (important for HOME, etc)
        const proc = spawn(cloudflaredBin, args, {
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // We return a Duplex-like object that ssh2 can use
        return {
            stdout: proc.stdout,
            stdin: proc.stdin,
            stderr: proc.stderr,
            proc // Keep reference to kill it later
        };
    }
}
