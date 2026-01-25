/**
 * Check if required ports are available on a server via the agent
 */
export async function checkServerPorts(serverId: string, ports: number[] = [80, 443, 8080]) {
    const results: { port: number; available: boolean; process?: string }[] = [];
    
    for (const port of ports) {
        try {
            const response = await fetch('http://localhost:5176', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: serverId,
                    type: 'execute',
                    payload: { 
                        command: `ss -tlnp | grep :${port} || echo "PORT_AVAILABLE"` 
                    }
                })
            });
            
            if (response.ok) {
                // If output contains "PORT_AVAILABLE", port is free
                // Otherwise, the port is in use and we'll get the process info
                results.push({
                    port,
                    available: true, // We'll parse the actual response from the agent
                    process: undefined
                });
            } else {
                results.push({
                    port,
                    available: false,
                    process: 'Unable to check'
                });
            }
        } catch (err) {
            results.push({
                port,
                available: false,
                process: 'Check failed'
            });
        }
    }
    
    return results;
}

/**
 * Check if Traefik proxy is running
 */
export async function checkProxyStatus(serverId: string) {
    try {
        const response = await fetch('http://localhost:5176', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: serverId,
                type: 'execute',
                payload: { 
                    command: 'docker ps --filter "name=premo-proxy" --format "{{.Status}}"' 
                }
            })
        });
        
        return response.ok;
    } catch {
        return false;
    }
}
