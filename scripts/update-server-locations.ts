import { db } from '../src/lib/server/db/client';
import { servers, destinations } from '../src/lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Script to update fake servers with realistic locations
 */
async function main() {
	console.log('--- Updating Server Locations ---');

	// 1. Get all servers
	const allServers = await db.select().from(servers);
	console.log(`Found ${allServers.length} servers.`);

	// 2. Identify swarm-related servers to keep them together
	const swarmDestinations = await db
		.select()
		.from(destinations)
		.where(eq(destinations.type, 'swarm'));
	
	const swarmServerIds = new Set(swarmDestinations.map(d => d.serverId));
	console.log(`Found ${swarmServerIds.size} servers associated with Swarm clusters.`);

	// 3. Define the update plan
	// We'll distribute servers across the requested locations
	const regions = ['sjc', 'lax', 'nj', 'mia', 'dfw', 'pdx', 'sea', 'fra', 'lhr', 'ber'];
	
	let regionIdx = 0;
	// Assign all swarm servers to the same "Primary Datacenter" (e.g., San Jose)
	const primarySwarmRegion = 'sjc';

	for (const server of allServers) {
		let targetRegion = '';
		
		if (swarmServerIds.has(server.id)) {
			targetRegion = primarySwarmRegion;
			console.log(`Setting Swarm Server [${server.name}] -> ${targetRegion}`);
		} else {
			targetRegion = regions[regionIdx % regions.length];
			regionIdx++;
			console.log(`Setting Server [${server.name}] -> ${targetRegion}`);
		}

		await db
			.update(servers)
			.set({ region: targetRegion })
			.where(eq(servers.id, server.id));
	}

	console.log('--- Update Complete ---');
	process.exit(0);
}

main().catch((err) => {
	console.error('Error updating server locations:', err);
	process.exit(1);
});
