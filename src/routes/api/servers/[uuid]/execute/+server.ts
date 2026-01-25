import { json } from '@sveltejs/kit';
import { executeCommand } from '$lib/server/services/ssh';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

    // Try to get team ID from locals.team, or fallback to finding a team the user belongs to.
    // Ideally, the hooks should populate locals.team based on session or user preference.
    let teamId = locals.team?.id;

    // If locals.team is not set (e.g. strict session implementation), we might panic or try to get it from context.
    // For now, allow it to fail if team is missing, as managing servers requires a team context.
    if (!teamId) {
         return json({ message: 'No active team found' }, { status: 400 });
    }

	const { command } = await request.json();
	const serverId = params.uuid;

	if (!command) {
		return json({ message: 'Command is required' }, { status: 400 });
	}

	try {
		const result = await executeCommand(serverId, teamId, command);
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
