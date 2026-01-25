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

    const appName = params.appName;

    try {
        const diagnostics: any = {
            appName,
            checks: []
        };

        // Check Traefik config file
        const configCheck = await fetch('http://localhost:5176', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: server.id,
                type: 'execute',
                payload: { command: `cat /data/premo/proxy/dynamic/${appName}.yml 2>/dev/null || echo "CONFIG_NOT_FOUND"` }
            })
        });

        diagnostics.checks.push({
            name: 'Traefik Config',
            command: `cat /data/premo/proxy/dynamic/${appName}.yml`,
            sent: configCheck.ok
        });

        // Check systemd service status
        const serviceCheck = await fetch('http://localhost:5176', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: server.id,
                type: 'execute',
                payload: { command: `systemctl status ${appName} --no-pager 2>/dev/null || echo "SERVICE_NOT_FOUND"` }
            })
        });

        diagnostics.checks.push({
            name: 'Systemd Service',
            command: `systemctl status ${appName}`,
            sent: serviceCheck.ok
        });

        // Check if port is listening
        const portCheck = await fetch('http://localhost:5176', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: server.id,
                type: 'execute',
                payload: { command: `ss -tlnp | grep :3000 || echo "PORT_NOT_LISTENING"` }
            })
        });

        diagnostics.checks.push({
            name: 'Port 3000 Listening',
            command: 'ss -tlnp | grep :3000',
            sent: portCheck.ok
        });

        // Check app logs
        const logsCheck = await fetch('http://localhost:5176', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: server.id,
                type: 'execute',
                payload: { command: `journalctl -u ${appName} -n 20 --no-pager 2>/dev/null || echo "NO_LOGS"` }
            })
        });

        diagnostics.checks.push({
            name: 'Service Logs',
            command: `journalctl -u ${appName} -n 20`,
            sent: logsCheck.ok
        });

        // List all dynamic configs
        const configsListCheck = await fetch('http://localhost:5176', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: server.id,
                type: 'execute',
                payload: { command: `ls -la /data/premo/proxy/dynamic/ 2>/dev/null || echo "DIR_NOT_FOUND"` }
            })
        });

        diagnostics.checks.push({
            name: 'All Traefik Configs',
            command: 'ls -la /data/premo/proxy/dynamic/',
            sent: configsListCheck.ok
        });

        return json({
            success: true,
            message: 'Diagnostic commands sent to agent. Check agent logs or server directly for results.',
            diagnostics,
            note: 'The agent executes these commands but does not return output yet. SSH into the server or check agent logs.'
        });
        
    } catch (err: any) {
        return json({ message: `Failed to run diagnostics: ${err.message}` }, { status: 500 });
    }
};
