import { api } from '../client';
import type { User } from '$lib/types';

/** Zig: GET /api/users — list users (God only, for context switcher / impersonation) */
export interface UsersResponse {
	data: Array<{
		id: string;
		name: string;
		email: string;
		email_verified: boolean;
		is_god: boolean;
		image?: string | null;
	}>;
}

export const usersApi = {
	getUsers: async (): Promise<User[]> => {
		try {
			const res = await api.get<UsersResponse>('/users');
			const data = (res.data as UsersResponse)?.data;
			if (!Array.isArray(data)) return [];
			return data.map((u) => ({
				id: u.id,
				name: u.name,
				email: u.email,
				emailVerifiedAt: null as Date | null,
				createdAt: new Date(),
				updatedAt: new Date()
			}));
		} catch {
			return [];
		}
	}
};
