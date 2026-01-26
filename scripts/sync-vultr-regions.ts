import { db } from '../src/lib/server/db/client';
import { servers, vpsProviders } from '../src/lib/server/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { VultrService } from '../src/lib/server/services/vps/vultr';

/**
 * Script to sync region data from Vultr for existing servers
 */
async function main() {
	console.log('--- Syncing Vultr Server Regions ---');

	// Get all servers with Vultr provider but missing region
	const serversToUpdate = await db
		.select({
			server: servers,
			provider: vpsProviders
		})
		.from(servers)
		.innerJoin(vpsProviders, eq(servers.vpsProviderId, vpsProviders.id))
		.where(
			and(
				isNotNull(servers.vpsProviderId),
				eq(vpsProviders.type, 'vultr'),
				isNotNull(vpsProviders.apiKey)
			)
		);

	console.log(`Found ${serversToUpdate.length} Vultr servers to check.`);

	let updated = 0;
	let skipped = 0;
	let errors = 0;

	for (const { server, provider } of serversToUpdate) {
		// Skip if region is already set
		if (server.region) {
			skipped++;
			continue;
		}

		try {
			const vultr = new VultrService(provider.apiKey);
			const instances = await vultr.listInstances();
			const instance = instances.find((i) => i.main_ip === server.ip);

			if (instance && instance.region) {
				await db
					.update(servers)
					.set({ region: instance.region })
					.where(eq(servers.id, server.id));

				console.log(`✓ Updated ${server.name} (${server.ip}) -> ${instance.region}`);
				updated++;
			} else {
				console.log(`⚠ No instance found for ${server.name} (${server.ip})`);
				skipped++;
			}
		} catch (err: any) {
			console.error(`✗ Error updating ${server.name}: ${err.message}`);
			errors++;
		}
	}

	console.log('\n--- Sync Complete ---');
	console.log(`Updated: ${updated}`);
	console.log(`Skipped: ${skipped}`);
	console.log(`Errors: ${errors}`);
	process.exit(0);
}

main().catch((err) => {
	console.error('Error syncing regions:', err);
	process.exit(1);
});
