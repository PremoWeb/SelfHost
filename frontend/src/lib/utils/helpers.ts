/**
 * Format a date string to a human-readable format
 */
export function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(date);
}

/**
 * Format a date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (diffInSeconds < 60) return 'just now';
	if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
	if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
	if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

	return formatDate(dateString);
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number): string {
	if (str.length <= maxLength) return str;
	return str.slice(0, maxLength) + '...';
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (error) {
		return false;
	}
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals = 2): string {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout> | null = null;

	return function executedFunction(...args: Parameters<T>) {
		const later = () => {
			timeout = null;
			func(...args);
		};

		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random ID
 */
export function generateId(): string {
	return crypto.randomUUID();
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(string: string): boolean {
	try {
		new URL(string);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get status color class based on status
 */
export function getStatusColor(status: string): string {
	const statusMap: Record<string, string> = {
		running: 'text-green-600 bg-green-100',
		stopped: 'text-gray-600 bg-gray-100',
		restarting: 'text-yellow-600 bg-yellow-100',
		exited: 'text-red-600 bg-red-100',
		degraded: 'text-orange-600 bg-orange-100',
		online: 'text-green-600 bg-green-100',
		offline: 'text-red-600 bg-red-100',
		unreachable: 'text-gray-600 bg-gray-100',
		queued: 'text-blue-600 bg-blue-100',
		in_progress: 'text-yellow-600 bg-yellow-100',
		finished: 'text-green-600 bg-green-100',
		failed: 'text-red-600 bg-red-100',
		cancelled: 'text-gray-600 bg-gray-100'
	};

	return statusMap[status] || 'text-gray-600 bg-gray-100';
}

/**
 * Extract error message from API error
 */
export function getErrorMessage(error: any): string {
	if (error.response?.data?.message) {
		return error.response.data.message;
	}

	if (error.response?.data?.errors) {
		const errors = error.response.data.errors;
		const firstError = Object.values(errors)[0];
		if (Array.isArray(firstError) && firstError.length > 0) {
			return firstError[0];
		}
	}

	if (error.message) {
		return error.message;
	}

	return 'An unexpected error occurred';
}
