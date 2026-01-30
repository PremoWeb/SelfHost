import { api } from '../client';

/** Zig: GET /api/companies — list companies (all for God, else for current user) */
export interface CompanyResponse {
	data: Array<{
		id: string;
		name: string;
		slug: string;
		created_by: string;
		settings: string;
		created_at: number;
		updated_at: number;
		description?: string | null;
		billing_profile_id?: string | null;
	}>;
}

export interface CompanyItem {
	id: string;
	name: string;
	slug: string;
	description?: string | null;
	[key: string]: unknown;
}

export const companiesApi = {
	getCompanies: async (): Promise<CompanyItem[]> => {
		try {
			const res = await api.get<CompanyResponse>('/companies');
			const data = (res.data as CompanyResponse)?.data;
			if (!Array.isArray(data)) return [];
			return data.map((c) => ({
				id: c.id,
				name: c.name,
				slug: c.slug,
				description: c.description ?? null
			}));
		} catch {
			return [];
		}
	}
};
