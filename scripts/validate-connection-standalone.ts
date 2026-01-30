#!/usr/bin/env bun
/**
 * Standalone runner for validating SSH connection to a server.
 * Outputs a single JSON line: { success, message, details? } for the Zig backend.
 * Usage: bun run scripts/validate-connection-standalone.ts <serverId> [teamId]
 * Env: DATABASE_URL (required, set by Zig when spawning)
 */
import { validateServerConnection } from '../src/lib/server/services/servers';

const [serverId, teamIdArg] = process.argv.slice(2);
if (!serverId) {
	console.log(JSON.stringify({ success: false, message: 'Usage: validate-connection-standalone.ts <serverId> [teamId]' }));
	process.exit(1);
}
const teamId = teamIdArg && teamIdArg !== 'null' && teamIdArg !== '' ? teamIdArg : null;

validateServerConnection(serverId, teamId)
	.then((result) => {
		console.log(JSON.stringify(result));
		process.exit(result.success ? 0 : 1);
	})
	.catch((err: Error) => {
		console.log(JSON.stringify({ success: false, message: err.message || 'Validation failed' }));
		process.exit(1);
	});
