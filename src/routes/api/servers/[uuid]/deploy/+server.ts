import { json } from '@sveltejs/kit';
import { getServerById } from '$lib/server/services/servers';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request }) => {
    await requireApiAuth(locals);
    await requireTeam(locals);
    
    const server = await getServerById(params.uuid, locals.team.id);
    if (!server) return json({ message: 'Server not found' }, { status: 404 });
    
    if (server.connectionType !== 'agent') {
        return json({ message: 'Server must use agent connection' }, { status: 400 });
    }

    const { appName, domain } = await request.json();
    
    if (!appName || !domain) {
        return json({ message: 'App name and domain are required' }, { status: 400 });
    }

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            
            const sendEvent = (step: string, message: string, status: 'pending' | 'in-progress' | 'success' | 'error' = 'in-progress') => {
                const data = JSON.stringify({ step, message, status });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            };

            try {
                const appDir = `/data/apps/${appName}`;
                const port = 3000; // We'll make this dynamic later
                
                sendEvent('prepare', 'Creating application directory...');
                
                // 1. Create app directory
                const mkdirResponse = await fetch('http://localhost:5176', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agentId: server.id,
                        type: 'execute',
                        payload: { command: `mkdir -p ${appDir}` }
                    })
                });
                
                if (!mkdirResponse.ok) {
                    sendEvent('prepare', 'Failed to create directory', 'error');
                    controller.close();
                    return;
                }
                
                sendEvent('prepare', 'Directory created', 'success');
                sendEvent('upload', 'Uploading application code...');
                
                // 2. Upload the test app code
                const domainVar = domain;
                const serverNameVar = server.name;
                const testAppCode = 'const server = Bun.serve({\n' +
                    '  port: process.env.PORT || ' + port + ',\n' +
                    '  hostname: \'0.0.0.0\',\n' +
                    '  fetch(req) {\n' +
                    '    const html = `<!DOCTYPE html>\n' +
                    '<html><head><title>Premo Test App</title>\n' +
                    '<style>body{margin:0;font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center}.container{background:#fff;padding:3rem;border-radius:1rem;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center;max-width:600px}h1{color:#667eea;margin:0 0 1rem;font-size:3rem}.emoji{font-size:4rem;margin-bottom:1rem}.info{background:#f7fafc;padding:1rem;border-radius:.5rem;margin-top:2rem;font-size:.875rem;color:#4a5568}.badge{display:inline-block;background:#667eea;color:#fff;padding:.5rem 1rem;border-radius:2rem;font-weight:700;margin-top:1rem}</style>\n' +
                    '</head><body><div class="container"><div class="emoji">⚡</div><h1>Hello, Premo!</h1>\n' +
                    '<p style="font-size:1.25rem;color:#718096">Deployed via Premo Agent + Firejail</p>\n' +
                    '<div class="badge">Running on ${domainVar}</div>\n' +
                    '<div class="info"><strong>Server:</strong> ${serverNameVar}<br><strong>Time:</strong> ${new Date().toISOString()}<br><strong>Bun:</strong> ${Bun.version}</div></div></body></html>`;\n' +
                    '    return new Response(html, { headers: { \'Content-Type\': \'text/html\' } });\n' +
                    '  }\n' +
                    '});';
                
                const uploadResponse = await fetch('http://localhost:5176', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agentId: server.id,
                        type: 'write_file',
                        payload: { path: `${appDir}/server.ts`, content: testAppCode }
                    })
                });
                
                if (!uploadResponse.ok) {
                    sendEvent('upload', 'Failed to upload code', 'error');
                    controller.close();
                    return;
                }
                
                sendEvent('upload', 'Code uploaded', 'success');
                sendEvent('upload', 'Code uploaded', 'success');
                sendEvent('systemd', 'Configuring service...');

                // Check for systemd
                const checkSystemd = await fetch('http://localhost:5176', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agentId: server.id,
                        type: 'execute',
                        payload: { command: 'command -v systemctl' }
                    })
                });
                
                const checkSystemdResult = await checkSystemd.json();
                // Check if command exit code is 0 (found) or if stdout has content
                const hasSystemd = checkSystemdResult.exitCode === 0 || (checkSystemdResult.stdout && checkSystemdResult.stdout.trim().length > 0);
                
                let serviceResponse;

                if (hasSystemd) {
                    // Systemd logic
                    const systemdService = `[Unit]
Description=Premo App - ${appName}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${appDir}
Environment="PORT=${port}"
ExecStart=/usr/local/bin/bun run server.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target`;
                    
                    serviceResponse = await fetch('http://localhost:5176', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            agentId: server.id,
                            type: 'write_file',
                            payload: { path: `/etc/systemd/system/${appName}.service`, content: systemdService }
                        })
                    });
                } else {
                    // OpenRC logic (Alpine)
                    const openRcScript = `#!/sbin/openrc-run

name="${appName}"
description="Premo App - ${appName}"
directory="${appDir}"
command="/usr/local/bin/bun"
command_args="run server.ts"
command_background=true
pidfile="/run/${appName}.pid"
output_log="/var/log/${appName}.log"
error_log="/var/log/${appName}.err"

export PORT="${port}"

depend() {
    need net
    use dns logger
}`;
                    
                    serviceResponse = await fetch('http://localhost:5176', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            agentId: server.id,
                            type: 'write_file',
                            payload: { path: `/etc/init.d/${appName}`, content: openRcScript }
                        })
                    });
                    
                    // Make script executable
                    await fetch('http://localhost:5176', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            agentId: server.id,
                            type: 'execute',
                            payload: { command: `chmod +x /etc/init.d/${appName}` }
                        })
                    });
                }
                
                if (!serviceResponse.ok) {
                    sendEvent('systemd', 'Failed to create service file', 'error');
                    controller.close();
                    return;
                }
                
                sendEvent('systemd', 'Service configured', 'success');
                sendEvent('traefik', 'Configuring Traefik routing...');
                
                // 4. Create Traefik dynamic config
                const traefikConfig = `http:
  routers:
    ${appName}:
      rule: "Host(\`${domain}\`)"
      service: ${appName}
      entryPoints:
        - https
      tls:
        certResolver: letsencrypt
  
  services:
    ${appName}:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:${port}"`;
                
                const traefikResponse = await fetch('http://localhost:5176', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agentId: server.id,
                        type: 'write_file',
                        payload: { path: `/data/premo/proxy/dynamic/${appName}.yml`, content: traefikConfig }
                    })
                });
                
                if (!traefikResponse.ok) {
                    sendEvent('traefik', 'Failed to configure routing', 'error');
                    controller.close();
                    return;
                }
                
                sendEvent('traefik', 'Routing configured', 'success');
                sendEvent('start', 'Starting application...');
                
                // 5. Enable and start the service
                let startCommand;
                if (hasSystemd) {
                    startCommand = `systemctl daemon-reload && systemctl enable ${appName} && systemctl restart ${appName}`;
                } else {
                    startCommand = `rc-update add ${appName} default && rc-service ${appName} restart`;
                }

                const startResponse = await fetch('http://localhost:5176', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agentId: server.id,
                        type: 'execute',
                        payload: { command: startCommand }
                    })
                });
                
                if (!startResponse.ok) {
                    sendEvent('start', 'Failed to start application', 'error');
                    controller.close();
                    return;
                }
                
                sendEvent('start', 'Application started', 'success');
                
                // 6. Save to database
                try {
                    const { db } = await import('$lib/server/db/client');
                    const { quickDeployApps } = await import('$lib/server/db/schema');
                    
                    await db.insert(quickDeployApps).values({
                        name: appName,
                        domain,
                        port,
                        status: 'running',
                        serverId: server.id,
                        teamId: locals.team!.id
                    });
                    
                } catch (dbErr) {
                    // Don't fail the deployment if DB save fails
                }
                
                sendEvent('complete', `Deployment complete! Visit https://${domain}`, 'success');
                
                controller.close();
            } catch (err: any) {
                sendEvent('error', err.message || 'Deployment failed', 'error');
                controller.close();
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
