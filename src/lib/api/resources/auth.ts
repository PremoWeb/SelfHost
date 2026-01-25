import { api } from '../client';
import type {
	ApiResponse,
	User,
	Team
} from '$lib/types';

/**
 * Authentication API endpoints
 */
export const authApi = {
	/**
	 * Login user
	 */
	login: async (email: string, password: string) => {
		return api.post<ApiResponse<{ user: User }>>('/auth/login', {
			email,
			password
		});
	},

	/**
	 * Logout user
	 */
	logout: async () => {
		return api.post<ApiResponse<{ message: string }>>('/auth/logout');
	},

	/**
	 * Get current authenticated user
	 */
	getCurrentUser: async () => {
		return api.get<ApiResponse<{ user: User; team: Team }>>('/auth/user');
	},

	/**
	 * Register new user
	 */
	register: async (data: { name: string; email: string; password: string }) => {
		return api.post<ApiResponse<{ user: User; team: Team }>>('/auth/register', data);
	}
};
