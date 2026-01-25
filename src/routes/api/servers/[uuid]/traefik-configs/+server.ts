import { json } from '@sveltejs/kit';
import { getServerById } from '$lib/server/services/servers';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
    await requireApiAuth(locals);
    await requireTeam(locals);
    
    const server = await getServerById(params.uuid, locals.team.id);
    if (!server) return json({ message: 'Server not found' }, { status: 404 });
    
    if (server.connectionType !== 'agent') {
        return json({ message: 'Server must use agent connection' }, { status: 400 });
    }

    try {
        // List all Traefik dynamic config files
        const listResponse = await fetch('http://localhost:5176', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: server.id,
                type: 'execute',
                payload: { command: 'ls -la /data/premo/proxy/dynamic/ 2>/dev/null || echo "NO_CONFIGS"' }
            })
        });
        
        if (!listResponse.ok) {
            return json({ message: 'Failed to list configs' }, { status: 500 });
        }

        // For now, just return success - in a real implementation we'd parse the response
        return json({ 
            message: 'Config check sent to agent',
            note: 'Check agent logs or SSH into server to view /data/premo/proxy/dynamic/'
        });
        
    } catch (err: any) {
        return json({ message: `Failed to check configs: ${err.message}` }, { status: 500 });
    }
};
