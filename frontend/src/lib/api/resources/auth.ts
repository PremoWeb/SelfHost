import { api } from '../client';
import type {
	ApiResponse,
	User,
	Team
} from '$lib/types';

/** Zig session response: GET /api/auth/session or /api/auth/get-session */
export interface SessionResponse {
	user: { id: string; email: string; name: string; isGod?: boolean };
	session: { id: string };
	team?: Team | null;
	isImpersonating?: boolean;
	impersonationType?: 'user' | 'team' | 'company';
	impersonatedBy?: { id: string; email: string; name: string; isGod?: boolean };
}

/**
 * Authentication API endpoints (Zig backend: /api/auth/*)
 */
export const authApi = {
	/**
	 * Login user (Zig: POST /api/auth/login or /api/auth/sign-in/email)
	 */
	login: async (email: string, password: string) => {
		return api.post<ApiResponse<{ user: User }>>('/auth/login', {
			email,
			password
		});
	},

	/**
	 * Logout user (Zig: POST /api/auth/logout or /api/auth/sign-out)
	 */
	logout: async () => {
		return api.post<ApiResponse<{ message: string }>>('/auth/logout');
	},

	/**
	 * Get current session from Zig (user + optional team).
	 * Uses GET /api/auth/session or /api/auth/get-session.
	 */
	getSession: async (): Promise<SessionResponse | null> => {
		try {
			const res = await api.get<SessionResponse | null>('/auth/session');
			const body = res.data;
			if (body && typeof body === 'object' && 'user' in body) return body;
			// Zig returns null when not authenticated
			return null;
		} catch {
			return null;
		}
	},

	/**
	 * Get current user and team (uses Zig session endpoint).
	 */
	getCurrentUser: async (): Promise<{ user: User; team: Team | null } | null> => {
		const session = await authApi.getSession();
		if (!session?.user) return null;
		const user: User = {
			id: session.user.id,
			name: session.user.name,
			email: session.user.email,
			emailVerifiedAt: null,
			createdAt: new Date(),
			updatedAt: new Date()
		};
		return { user, team: session.team ?? null };
	},

	/**
	 * Register new user (Zig: not yet implemented)
	 */
	register: async (data: { name: string; email: string; password: string }) => {
		return api.post<ApiResponse<{ user: User; team: Team }>>('/auth/register', data);
	}
};
