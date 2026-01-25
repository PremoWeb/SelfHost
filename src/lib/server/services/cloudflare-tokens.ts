import { db } from '../db/client';
import { cloudflareAccessTokens } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { NewCloudflareAccessToken } from '../db/schema';

export async function getCloudflareAccessTokensByTeam(teamId: string | null | undefined) {
    return await db.query.cloudflareAccessTokens.findMany({
        where: teamId ? eq(cloudflareAccessTokens.teamId, teamId) : undefined
    });
}

export async function createCloudflareAccessToken(data: NewCloudflareAccessToken) {
    const [token] = await db.insert(cloudflareAccessTokens).values(data).returning();
    return token;
}

export async function deleteCloudflareAccessToken(id: string, teamId: string | null | undefined) {
    const [token] = await db
        .delete(cloudflareAccessTokens)
        .where(
            and(
                eq(cloudflareAccessTokens.id, id),
                teamId ? eq(cloudflareAccessTokens.teamId, teamId) : undefined
            )
        )
        .returning();
    return token;
}
