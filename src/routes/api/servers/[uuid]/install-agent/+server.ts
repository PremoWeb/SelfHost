import { json } from '@sveltejs/kit';
import { installAgent } from '$lib/server/services/agent';
import type { RequestHandler } from './$types';

import { isGod } from '$lib/server/auth/permissions';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const serverId = params.uuid;
    const isGodUser = await isGod(locals.user?.id);

	if ((!locals.team && !isGodUser) || !serverId) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const { callbackUrl } = await request.json();

	const stream = new ReadableStream({
		async start(controller) {
			let isClosed = false;
			const safeEnqueue = (data: any) => {
				if (!isClosed) {
					try {
						controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
					} catch (e: any) {
						if (e.message?.includes('Controller is already closed')) {
							// Ignore expected error when client disconnects
							isClosed = true;
						} else {
						}
					}
				}
			};

			const send = (data: any) => {
				safeEnqueue(data);
			};

			try {
				await installAgent(serverId, locals.team?.id || null, callbackUrl, 
                    (step, message) => {
					    send({ step, message, status: 'in-progress' });
				    },
                    (log) => {
                        send({ step: 'log', message: log });
                    }
                );
				send({ step: 'complete', message: 'Installation complete!', status: 'success', tunnelUrl: callbackUrl });
			} catch (err: any) {
				send({ step: 'error', message: err.message || 'Unknown error', status: 'error' });
			} finally {
				controller.close();
				isClosed = true;
			}
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
