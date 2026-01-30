#!/usr/bin/env bun
/**
 * Standalone runner for installing the SelfHost agent on a server.
 * Outputs one JSON object per line (step, message, etc.) for the Zig backend to stream as SSE.
 * Usage: bun run scripts/install-agent-standalone.ts <serverId> <callbackUrl> [teamId]
 * Env: DATABASE_URL (required, set by Zig when spawning)
 */
import { installAgent } from '../src/lib/server/services/agent';

function send(data: object) {
	console.log(JSON.stringify(data));
}

const [serverId, callbackUrl, teamIdArg] = process.argv.slice(2);
if (!serverId || !callbackUrl) {
	send({ step: 'error', message: 'Usage: install-agent-standalone.ts <serverId> <callbackUrl> [teamId]', status: 'error' });
	process.exit(1);
}
const teamId = teamIdArg && teamIdArg !== 'null' && teamIdArg !== '' ? teamIdArg : null;

installAgent(
	serverId,
	teamId,
	callbackUrl,
	(step, message) => send({ step, message, status: 'in-progress' }),
	(log) => send({ step: 'log', message: log })
)
	.then(() => {
		send({ step: 'complete', message: 'Installation complete!', status: 'success', tunnelUrl: callbackUrl });
		process.exit(0);
	})
	.catch((err: Error) => {
		send({ step: 'error', message: err.message || 'Unknown error', status: 'error' });
		process.exit(1);
	});
