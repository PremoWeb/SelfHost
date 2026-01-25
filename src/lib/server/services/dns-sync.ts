import { db } from '$lib/server/db/client';
import { servers, domains, dnsRecords } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { VultrService } from './vps/vultr';
import { getVpsProvidersByTeam } from './vps/providers';

/**
 * Sync DNS records to Vultr based on their syncMode
 * - static: Use the value field directly
 * - server: Use the IP of the specified server
 * - tag: Create records for all servers with the matching tag
 */
export async function syncDnsRecordToProvider(recordId: string, teamId: string | null | undefined) {
    // Get the DNS record with its domain
    const record = await db.query.dnsRecords.findFirst({
        where: eq(dnsRecords.id, recordId),
        with: {
            domain: true,
            server: true
        }
    });

    if (!record || !record.domain) {
        throw new Error('DNS record or domain not found');
    }

    // Only sync to Vultr domains
    if (record.domain.provider !== 'vultr') {
        return;
    }

    // Get Vultr API key
    // If teamId is missing, we should ideally use the domain owner...
    // But for now relying on getVpsProvidersByTeam's fallback (all providers) if God.
    const providers = await getVpsProvidersByTeam(teamId);
    const vultrProvider = providers.find(p => p.type === 'vultr');
    
    if (!vultrProvider?.apiKey) {
        throw new Error('Vultr provider not configured');
    }

    const vultr = new VultrService(vultrProvider.apiKey);
    const domainName = record.domain.name;

    // Determine which IPs to use based on syncMode
    let ipsToSync: string[] = [];

    if (record.syncMode === 'static') {
        if (record.value) {
            ipsToSync = [record.value];
        }
    } else if (record.syncMode === 'server' && record.serverId) {
        const server = await db.query.servers.findFirst({
            where: eq(servers.id, record.serverId)
        });
        if (server?.ip) {
            ipsToSync = [server.ip];
        }
    } else if (record.syncMode === 'tag' && record.syncTag) {
        // Find all servers with this tag
        // If teamId is present, filter by team. If not (Company?), try to match domain owner?
        // Note: 'servers' table has ownerType/ownerId.
        
        let serverWhere;
        if (teamId) {
            serverWhere = eq(servers.teamId, teamId);
        } else if (record.domain.ownerId) {
             // Fallback to domain owner
             serverWhere = eq(servers.ownerId, record.domain.ownerId);
        } else {
            // No strict owner filter? God mode implied? 
            // Better to match domain owner to avoid leaking servers
            serverWhere = undefined; 
        }

        if (!serverWhere) {
             // If we can't determine scope, careful... returning empty to be safe
             // unless we want to allow ALL servers for God admin?
             // Let's assume if teamId is null, we check ownerId. 
             // If both null, we skip tag sync.
             return;
        }

        const taggedServers = await db.query.servers.findMany({
            where: serverWhere
        });
        
        ipsToSync = taggedServers
            .filter(s => s.tags && s.tags.includes(record.syncTag!))
            .map(s => s.ip)
            .filter(Boolean) as string[];
    }

    if (ipsToSync.length === 0) {
        return;
    }


    // Get existing records from Vultr
    const existingRecords = await vultr.listRecords(domainName);
    const recordName = record.name === '@' ? '' : record.name;

    // Find existing records with the same name and type
    const matchingRecords = existingRecords.filter((r: any) => 
        r.name === recordName && r.type === record.type
    );

    // Delete old records
    for (const oldRecord of matchingRecords) {
        try {
            await vultr.deleteRecord(domainName, oldRecord.id);
        } catch (err) {
        }
    }

    // Create new records for each IP
    for (const ip of ipsToSync) {
        try {
            await vultr.createRecord(domainName, {
                type: record.type,
                name: recordName,
                data: ip,
                ttl: record.ttl || 3600,
                priority: record.priority || undefined
            });
        } catch (err) {
        }
    }
}

/**
 * Sync all DNS records for a domain
 */
export async function syncAllDnsRecordsForDomain(domainId: string, teamId: string) {
    const records = await db.query.dnsRecords.findMany({
        where: and(
            eq(dnsRecords.domainId, domainId),
            eq(dnsRecords.teamId, teamId)
        )
    });

    for (const record of records) {
        try {
            await syncDnsRecordToProvider(record.id, teamId);
        } catch (err) {
        }
    }
}

/**
 * Sync DNS records when a server's IP or tags change
 */
export async function syncDnsRecordsForServer(serverId: string, teamId: string) {
    const server = await db.query.servers.findFirst({
        where: eq(servers.id, serverId)
    });

    if (!server) return;

    // Find all DNS records that reference this server (by ID or tag)
    const allRecords = await db.query.dnsRecords.findMany({
        where: eq(dnsRecords.teamId, teamId)
    });

    const recordsToSync = allRecords.filter(record => {
        if (record.syncMode === 'server' && record.serverId === serverId) {
            return true;
        }
        if (record.syncMode === 'tag' && record.syncTag && server.tags?.includes(record.syncTag)) {
            return true;
        }
        return false;
    });

    for (const record of recordsToSync) {
        try {
            await syncDnsRecordToProvider(record.id, teamId);
        } catch (err) {
        }
    }
}
