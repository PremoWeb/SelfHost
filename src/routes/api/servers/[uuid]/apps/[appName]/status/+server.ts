import { json } from '@sveltejs/kit';
import { getServerById } from '$lib/server/services/servers';
import { db } from '$lib/server/db/client';
import { quickDeployApps } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
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
        // 1. Check init system
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

        // 2. Check Service Status
        let statusCommand;
        if (hasSystemd) {
            statusCommand = `systemctl is-active ${appName}`;
        } else {
            statusCommand = `rc-service ${appName} status`;
        }
        
        const response = await fetch('http://localhost:5176', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: server.id,
                type: 'execute',
                payload: { command: statusCommand }
            })
        });

        const result = await response.json();
        
        // Determine status
        let status = 'stopped';
        if (hasSystemd) {
             if (result.stdout?.trim() === 'active') status = 'running';
        } else {
            // OpenRC: "status: started" or similar
            if (result.stdout?.includes('status: started') || result.stdout?.includes('is running')) status = 'running';
            // Also check exit code behavior for OpenRC, sometimes it exits non-zero if stopped
        }

        // 3. Update Database (Sync)
        await db.update(quickDeployApps)
            .set({ status })
            .where(eq(quickDeployApps.name, appName));

        return json({ success: true, status, output: result.stdout });
        
    } catch (err: any) {
        return json({ message: `Failed to check status: ${err.message}` }, { status: 500 });
    }
};
