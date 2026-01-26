import { error } from '@sveltejs/kit';
import { Client } from 'ssh2';
import { db } from '$lib/server/db/client';
import { servers, privateKeys } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { isGod } from '$lib/server/auth/permissions';
import { getPrivateKeyById } from '$lib/server/services/security';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
    const { uuid } = params;
    const teamId = locals.team?.id;
    const userIsGod = locals.user?.id ? await isGod(locals.user.id) : false;

    if (!teamId && !userIsGod) {
        throw error(401, 'Unauthorized');
    }

    const server = await db.query.servers.findFirst({
        where: eq(servers.id, uuid)
    });

    if (!server) {
        throw error(404, 'Server not found');
    }

    if (!server.privateKeyId) {
        throw error(400, 'No private key configured');
    }

    const privateKey = await getPrivateKeyById(server.privateKeyId, teamId || null, userIsGod);

    if (!privateKey) {
        throw error(400, 'Private key not found');
    }

    let cleanupFn: () => void;

    const stream = new ReadableStream({
        async start(controller) {
            // Immediate feedback to client
            controller.enqueue(`data: ${JSON.stringify({ type: 'status', message: 'initializing' })}\n\n`);

            const conn = new Client();
            let isClosed = false;
            let proxy: any = undefined;

            // Handle client disconnect
            const safeClose = () => {
                if (!isClosed) {
                    isClosed = true;
                    try { conn.end(); } catch (e) {}
                    if (proxy) try { proxy.proc.kill(); } catch (e) {}
                    try { controller.close(); } catch (e) {}
                }
            };
            
            // Assign to the outer variable so cancel() can access it
            cleanupFn = () => {
                isClosed = true;
                try { conn.end(); } catch (e) {}
                if (proxy) try { proxy.proc.kill(); } catch (e) {}
                // Don't call controller.close() in cancel() as the stream is already cancelling
            };

            // Set up connection options
            let connectOptions: any = {
                username: server.user,
                privateKey: privateKey.privateKey,
                readyTimeout: 10000,
                keepaliveInterval: 10000
            };

            // Handle Cloudflare tunnel if configured
            if (server.cloudflareTunnelHostname) {
                const { CloudflareAccessService } = await import('$lib/server/services/cloudflare-access');
                const { Duplex } = await import('node:stream');

                controller.enqueue(`data: ${JSON.stringify({ type: 'status', message: 'connecting_via_tunnel' })}\n\n`);

                proxy = await CloudflareAccessService.getSshProxyStream(
                    server.cloudflareTunnelHostname,
                    server.cloudflareAccessTokenId
                );
                
                const duplex = new Duplex({
                    read() {},
                    write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
                        proxy.stdin.write(chunk, encoding, callback);
                    }
                });
                
                proxy.stdout.on('data', (c: Buffer) => duplex.push(c));
                proxy.stdout.on('end', () => duplex.push(null));
                proxy.proc.on('error', (e: Error) => {
                    if (!isClosed) {
                        controller.enqueue(`data: ${JSON.stringify({ error: `Tunnel error: ${e.message}` })}\n\n`);
                    }
                    safeClose();
                });
                proxy.proc.on('exit', (code: number) => {
                    if (code !== 0 && !isClosed) {
                        controller.enqueue(`data: ${JSON.stringify({ error: `Tunnel exited with code ${code}` })}\n\n`);
                        safeClose();
                    }
                });

                conn.on('end', () => {
                    if (proxy) proxy.proc.kill();
                });
                conn.on('error', () => {
                    if (proxy) proxy.proc.kill();
                });

                connectOptions.sock = duplex;
            } else {
                // Direct connection
                connectOptions.host = server.ip;
                connectOptions.port = server.port;
            }

            conn.on('ready', () => {
                // Send a connected event to the client so UI can update
                controller.enqueue(`data: ${JSON.stringify({ type: 'status', message: 'connected' })}\n\n`);

                // Use tail -F to retry if file doesn't exist yet (e.g. during install)
                // Removed pty: true to avoid "Unable to request a pseudo-terminal" errors
                // tail -F usually handles flushing reasonably well even without a PTY
                conn.exec('tail -F -n 200 /var/log/selfhost-agent.log', (err, stream) => {
                    if (err) {
                        if (!isClosed) controller.enqueue(`data: ${JSON.stringify({ error: `Exec failed: ${err.message}` })}\n\n`);
                        safeClose();
                        return;
                    }

                    stream.on('data', (data: Buffer) => {
                        if (isClosed) return;
                        const text = data.toString();
                        try {
                            controller.enqueue(`data: ${JSON.stringify({ log: text })}\n\n`);
                        } catch (e) {
                             isClosed = true;
                        }
                    });

                    stream.stderr.on('data', (data: Buffer) => {
                         if (isClosed) return;
                         try {
                            controller.enqueue(`data: ${JSON.stringify({ log: data.toString() })}\n\n`);
                         } catch (e) {
                            isClosed = true;
                         }
                    });

                    stream.on('close', () => {
                        if (!isClosed) {
                            try {
                                controller.enqueue(`data: ${JSON.stringify({ log: '\n[Stream ended]\n' })}\n\n`);
                                safeClose();
                            } catch (e) {
                                isClosed = true;
                            }
                        }
                    });
                });
            })
            .on('error', (err) => {
                 if (!isClosed) {
                    try {
                        controller.enqueue(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                    } catch (e) {}
                 }
                 safeClose();
            })
            .on('end', () => {
                safeClose();
            })
            .connect(connectOptions);
        },
        cancel() {
             if (cleanupFn) cleanupFn();
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
