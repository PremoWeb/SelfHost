import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { executeCommand } from '$lib/server/services/ssh';
import { db } from '$lib/server/db/client';
import { servers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, locals }) => {
    try {
        const { uuid } = params;
        const teamId = locals.team?.id;

        if (!teamId) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const server = await db.query.servers.findFirst({
            where: and(eq(servers.id, uuid), eq(servers.teamId, teamId))
        });

        if (!server) {
            return json({ error: 'Server not found' }, { status: 404 });
        }

        // Fetch combined agent and wrapper logs
        const cmd = 'tail -n 200 /var/log/selfhost-agent.log 2>/dev/null || echo "No agent logs found at /var/log/selfhost-agent.log"';
        
        const result = await executeCommand(server.id, teamId, cmd);
        
        const logs = result.stdout || result.stderr || 'No logs could be retrieved.';

        return json({ logs });
    } catch (err: any) {
        return json({ error: err.message }, { status: 500 });
    }
};
