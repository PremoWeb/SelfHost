import { api } from '../client';
import type { Team } from '$lib/types';

/** Zig: GET /api/teams — list teams for current user */
export interface TeamsResponse {
	data: (Omit<Team, 'createdAt' | 'updatedAt'> & {
		createdAt?: string | number;
		updatedAt?: string | number;
	})[];
}

function toDate(v: string | number | undefined): Date {
	if (v == null) return new Date();
	const n = typeof v === 'string' ? parseInt(v, 10) : v;
	return new Date(Number.isNaN(n) ? 0 : n * 1000);
}

export const teamsApi = {
	getTeams: async (): Promise<Team[]> => {
		try {
			const res = await api.get<TeamsResponse>('/teams');
			const data = (res.data as TeamsResponse)?.data;
			if (!Array.isArray(data)) return [];
			return data.map((t) => ({
				...t,
				description: t.description ?? null,
				createdAt: toDate(t.createdAt),
				updatedAt: toDate(t.updatedAt)
			})) as Team[];
		} catch {
			return [];
		}
	}
};
