import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { toastStore } from '$lib/stores/toast';

/**
 * API Client for SelfHost Backend
 *
 * Handles all HTTP communication with the SvelteKit API routes.
 * Shows a toast for unimplemented or broken routes (404, 501, 5xx) so pages can
 * use fallback data and the user gets clear feedback.
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
	 * Show a toast for failed API calls and optionally attach a fallback-friendly flag.
	 */
	private notifyApiError(error: AxiosError): void {
		if (!browser || !error.response) return;
		const status = error.response.status;
		const data = error.response.data as { error?: string; message?: string } | undefined;
		const message = data?.error ?? data?.message;

		if (status === 404) {
			toastStore.warning(
				message && typeof message === 'string' ? message : 'This feature or resource is not available yet.'
			);
			return;
		}
		if (status === 501) {
			toastStore.warning(
				message && typeof message === 'string' ? message : 'This action is not implemented yet.'
			);
			return;
		}
		if (status >= 502 && status <= 503) {
			toastStore.error('Service temporarily unavailable. Please try again.');
			return;
		}
		if (status === 500) {
			toastStore.error(
				message && typeof message === 'string' ? message : 'Something went wrong on the server.'
			);
		}
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
					// Toast for unimplemented/broken routes so pages can show fallback and user gets feedback
					this.notifyApiError(error);

					// Handle 401 Unauthorized - redirect to login
					if (error.response?.status === 401) {
						goto('/login');
					}

					// Handle 403 Forbidden
					if (error.response?.status === 403) {
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

/**
 * Returns true if the error is from an unimplemented or missing API route (404, 501).
 * Use in load functions to return fallback data and avoid breaking the page:
 *
 *   try {
 *     const res = await api.get('/things');
 *     return { things: res.data?.data ?? [] };
 *   } catch (e) {
 *     if (isUnimplementedRoute(e)) return { things: [] };
 *     throw e;
 *   }
 */
export function isUnimplementedRoute(error: unknown): boolean {
	const status = (error as AxiosError)?.response?.status;
	return status === 404 || status === 501;
}
