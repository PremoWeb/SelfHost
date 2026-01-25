
import { db } from '../src/lib/server/db/client';
import { servers } from '../src/lib/server/db/schema';

async function main() {
    console.log("Detaching private keys from all servers...");
    const result = await db.update(servers).set({ privateKeyId: null }).returning();
    console.log(`Updated ${result.length} servers.`);
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
