import { api } from '../client';
import type {
	ApiResponse,
	Server,
	CreateServerDto,
	UpdateServerDto
} from '$lib/types';

/**
 * Servers API endpoints
 */
export const serversApi = {
	/**
	 * Get all servers for current team
	 */
	getAll: async () => {
		return api.get<ApiResponse<Server[]>>('/servers');
	},

	/**
	 * Get server by UUID
	 */
	getById: async (uuid: string) => {
		return api.get<ApiResponse<Server>>(`/servers/${uuid}`);
	},

	/**
	 * Create new server
	 */
	create: async (data: CreateServerDto) => {
		return api.post<ApiResponse<Server>>('/servers', data);
	},

	/**
	 * Update server
	 */
	update: async (uuid: string, data: UpdateServerDto) => {
		return api.patch<ApiResponse<Server>>(`/servers/${uuid}`, data);
	},

	/**
	 * Delete server
	 */
	delete: async (uuid: string) => {
		return api.delete<ApiResponse<{ message: string }>>(`/servers/${uuid}`);
	},

	/**
	 * Validate server connection
	 */
	validateConnection: async (uuid: string) => {
		return api.post<{ success: boolean; message: string; details?: any }>(
			`/servers/${uuid}/validate`
		);
	}
};
