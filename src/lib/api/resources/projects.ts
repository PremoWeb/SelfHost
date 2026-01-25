import { api } from '../client';
import type {
	ApiResponse,
	Project,
	CreateProjectDto,
	UpdateProjectDto
} from '$lib/types';

/**
 * Projects API endpoints
 */
export const projectsApi = {
	/**
	 * Get all projects for current team
	 */
	getAll: async () => {
		return api.get<ApiResponse<Project[]>>('/projects');
	},

	/**
	 * Get project by UUID
	 */
	getById: async (uuid: string) => {
		return api.get<ApiResponse<Project>>(`/projects/${uuid}`);
	},

	/**
	 * Create new project
	 */
	create: async (data: CreateProjectDto) => {
		return api.post<ApiResponse<Project>>('/projects', data);
	},

	/**
	 * Update project
	 */
	update: async (uuid: string, data: UpdateProjectDto) => {
		return api.patch<ApiResponse<Project>>(`/projects/${uuid}`, data);
	},

	/**
	 * Delete project
	 */
	delete: async (uuid: string) => {
		return api.delete<ApiResponse<{ message: string }>>(`/projects/${uuid}`);
	}
};
