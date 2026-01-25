import { error } from '@sveltejs/kit';
import { Client } from 'ssh2';
import { db } from '$lib/server/db/client';
import { servers, privateKeys } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
    const { uuid } = params;
    const teamId = locals.team?.id;

    if (!teamId) {
        throw error(401, 'Unauthorized');
    }

    const server = await db.query.servers.findFirst({
        where: and(eq(servers.id, uuid), eq(servers.teamId, teamId))
    });

    if (!server) {
        throw error(404, 'Server not found');
    }

    if (!server.privateKeyId) {
        throw error(400, 'No private key configured');
    }

    const privateKey = await db.query.privateKeys.findFirst({
        where: and(eq(privateKeys.id, server.privateKeyId), eq(privateKeys.teamId, teamId))
    });

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

            // Handle client disconnect
            const safeClose = () => {
                if (!isClosed) {
                    isClosed = true;
                    try { conn.end(); } catch (e) {}
                    try { controller.close(); } catch (e) {}
                }
            };
            
            // Assign to the outer variable so cancel() can access it
            cleanupFn = () => {
                isClosed = true;
                try { conn.end(); } catch (e) {}
                // Don't call controller.close() in cancel() as the stream is already cancelling
            };

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
            .connect({
                host: server.ip,
                port: server.port,
                username: server.user,
                privateKey: privateKey.privateKey,
                readyTimeout: 10000,
                keepaliveInterval: 10000
            });
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
