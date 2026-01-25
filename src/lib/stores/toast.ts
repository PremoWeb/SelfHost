import { writable } from 'svelte/store';

interface ToastMessage {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info' | 'loading';
	message: string;
	duration?: number;
}

/**
 * Toast notification store
 * 
 * Manages toast notifications for user feedback
 */
function createToastStore() {
	const { subscribe, update } = writable<ToastMessage[]>([]);

	return {
		subscribe,

		/**
		 * Show a success toast
		 */
		success: (message: string, duration = 3000) => {
			const id = crypto.randomUUID();
			update((toasts) => [...toasts, { id, type: 'success', message, duration }]);
			setTimeout(() => remove(id), duration);
		},

		/**
		 * Show an error toast
		 */
		error: (message: string, duration = 5000) => {
			const id = crypto.randomUUID();
			update((toasts) => [...toasts, { id, type: 'error', message, duration }]);
			setTimeout(() => remove(id), duration);
		},

		/**
		 * Show a warning toast
		 */
		warning: (message: string, duration = 4000) => {
			const id = crypto.randomUUID();
			update((toasts) => [...toasts, { id, type: 'warning', message, duration }]);
			setTimeout(() => remove(id), duration);
		},

		/**
		 * Show an info toast
		 */
		info: (message: string, duration = 3000) => {
			const id = crypto.randomUUID();
			update((toasts) => [...toasts, { id, type: 'info', message, duration }]);
			setTimeout(() => remove(id), duration);
		},

		/**
		 * Show a loading toast
		 */
		loading: (message: string, duration = 3000) => {
			const id = crypto.randomUUID();
			update((toasts) => [...toasts, { id, type: 'loading', message, duration }]);
			setTimeout(() => remove(id), duration);
		},

		/**
		 * Remove a specific toast
		 */
		remove: (id: string) => {
			update((toasts) => toasts.filter((t) => t.id !== id));
		}
	};

	function remove(id: string) {
		update((toasts) => toasts.filter((t) => t.id !== id));
	}
}

export const toastStore = createToastStore();
