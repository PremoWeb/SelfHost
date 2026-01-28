import { json } from '@sveltejs/kit';
import { executeCommand } from '$lib/server/services/ssh';
import { isGod } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const userIsGod = await isGod(locals.user.id);
    let teamId = locals.team?.id;

    // Allow god users to execute commands without team context
    if (!teamId && !userIsGod) {
         return json({ message: 'No active team found' }, { status: 400 });
    }

	const { command } = await request.json();
	const serverId = params.uuid;
	const shouldStream = new URL(request.url).searchParams.get('stream') === 'true';

	if (!command) {
		return json({ message: 'Command is required' }, { status: 400 });
	}

	try {
		if (shouldStream) {
			const stream = new ReadableStream({
				async start(controller) {
					try {
						await executeCommand(serverId, teamId || null, command, (data) => {
							controller.enqueue(data);
						}, request.signal);
					} catch (e: any) {
						controller.enqueue(`\x1b[1;31mError: ${e.message}\x1b[0m`);
					} finally {
						controller.close();
					}
				}
			});

			return new Response(stream, {
				headers: {
					'Content-Type': 'text/plain',
					'X-Content-Type-Options': 'nosniff'
				}
			});
		}

		const result = await executeCommand(serverId, teamId || null, command, undefined, request.signal);
		return json(result);
	} catch (error: any) {
		return json({ 
			success: false, 
			message: error.message,
            stdout: '',
            stderr: error.message
		}, { status: 500 });
	}
};
