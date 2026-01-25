import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';

/**
 * API Client for SelfHost Backend
 * 
 * Handles all HTTP communication with the SvelteKit API routes.
 */
class ApiClient {
	private client: AxiosInstance;

	constructor() {
		this.client = axios.create({
			baseURL: '/api',
			withCredentials: true,
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			}
		});

		this.setupInterceptors();
	}

	/**
	 * Setup request and response interceptors
	 */
	private setupInterceptors(): void {
		// Response interceptor
		this.client.interceptors.response.use(
			(response) => response,
			(error: AxiosError) => {
				if (browser) {
					// Handle 401 Unauthorized - redirect to login
					if (error.response?.status === 401) {
						goto('/login');
					}

					// Handle 403 Forbidden
					if (error.response?.status === 403) {
					}

					// Handle 500 Server Error
					if (error.response?.status === 500) {
					}
				}

				return Promise.reject(error);
			}
		);
	}

	/**
	 * GET request
	 */
	async get<T>(url: string, config = {}) {
		const response = await this.client.get<T>(url, config);
		return response;
	}

	/**
	 * POST request
	 */
	async post<T>(url: string, data = {}, config = {}) {
		const response = await this.client.post<T>(url, data, config);
		return response;
	}

	/**
	 * PUT request
	 */
	async put<T>(url: string, data = {}, config = {}) {
		const response = await this.client.put<T>(url, data, config);
		return response;
	}

	/**
	 * PATCH request
	 */
	async patch<T>(url: string, data = {}, config = {}) {
		const response = await this.client.patch<T>(url, data, config);
		return response;
	}

	/**
	 * DELETE request
	 */
	async delete<T>(url: string, config = {}) {
		const response = await this.client.delete<T>(url, config);
		return response;
	}

	/**
	 * Upload file with progress tracking
	 */
	async upload<T>(
		url: string,
		file: File,
		onProgress?: (progress: number) => void
	) {
		const formData = new FormData();
		formData.append('file', file);

		const response = await this.client.post<T>(url, formData, {
			headers: {
				'Content-Type': 'multipart/form-data'
			},
			onUploadProgress: (progressEvent) => {
				if (onProgress && progressEvent.total) {
					const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
					onProgress(progress);
				}
			}
		});

		return response;
	}
}

// Export singleton instance
export const api = new ApiClient();
