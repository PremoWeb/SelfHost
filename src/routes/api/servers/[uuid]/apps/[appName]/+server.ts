import { json } from '@sveltejs/kit';
import { getServerById } from '$lib/server/services/servers';
import { db } from '$lib/server/db/client';
import { quickDeployApps } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
    await requireApiAuth(locals);
    await requireTeam(locals);
    
    const serverId = params.uuid;
    const appName = params.appName;
    
    const server = await getServerById(serverId, locals.team.id);
    if (!server) return json({ message: 'Server not found' }, { status: 404 });
    
    if (server.connectionType !== 'agent') {
        return json({ message: 'Server must use agent connection' }, { status: 400 });
    }

    try {
        // 1. Check for systemd vs OpenRC
        const checkSystemd = await fetch('http://localhost:5176', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: server.id,
                type: 'execute',
                payload: { command: 'command -v systemctl' }
            })
        });
        const hasSystemd = checkSystemd.ok;

        // 2. Stop and Disable Service
        let stopCommand;
        if (hasSystemd) {
            stopCommand = `systemctl stop ${appName} && systemctl disable ${appName} && rm /etc/systemd/system/${appName}.service && systemctl daemon-reload`;
        } else {
            stopCommand = `rc-service ${appName} stop && rc-update del ${appName} default && rm /etc/init.d/${appName}`;
        }
        
        await fetch('http://localhost:5176', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: server.id,
                type: 'execute',
                payload: { command: stopCommand }
            })
        });

        // 3. Remove App Files
        await fetch('http://localhost:5176', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: server.id,
                type: 'execute',
                payload: { command: `rm -rf /data/apps/${appName}` }
            })
        });

        // 4. Remove Traefik Config
        await fetch('http://localhost:5176', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: server.id,
                type: 'execute',
                payload: { command: `rm /data/premo/proxy/dynamic/${appName}.yml` }
            })
        });

        // 5. Remove from Database
        await db.delete(quickDeployApps)
            .where(eq(quickDeployApps.name, appName));

        return json({ success: true, message: 'App deleted successfully' });
        
    } catch (err: any) {
        return json({ message: `Failed to delete app: ${err.message}` }, { status: 500 });
    }
};
