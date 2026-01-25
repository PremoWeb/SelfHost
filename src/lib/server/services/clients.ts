import { db } from '../db';
import { clients } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { Client, NewClient } from '../db/schema';

export const clientsService = {
	async getClientsByTeam(teamId: string) {
		return await db.query.clients.findMany({
			where: eq(clients.teamId, teamId),
			orderBy: (clients, { desc }) => [desc(clients.createdAt)]
		});
	},

	async getClientById(id: string, teamId: string) {
		return await db.query.clients.findFirst({
			where: and(eq(clients.id, id), eq(clients.teamId, teamId))
		});
	},

	async getClientWithProjects(id: string, teamId: string) {
		return await db.query.clients.findFirst({
			where: and(eq(clients.id, id), eq(clients.teamId, teamId)),
			with: {
				projects: {
					with: {
						environments: true
					}
				}
			}
		});
	},

	async createClient(data: NewClient) {
		const [client] = await db.insert(clients).values(data).returning();
		return client;
	},

	async updateClient(id: string, teamId: string, data: Partial<NewClient>) {
		const [client] = await db
			.update(clients)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(clients.id, id), eq(clients.teamId, teamId)))
			.returning();
		return client;
	},

	async deleteClient(id: string, teamId: string) {
		await db.delete(clients).where(and(eq(clients.id, id), eq(clients.teamId, teamId)));
	}
};
