<script lang="ts">
	import { toastStore } from '$lib/stores/toast';
	import { fly } from 'svelte/transition';

	const icons = {
		success: '✓',
		error: '✕',
		warning: '⚠',
		info: 'ℹ',
		loading: '⏳'
	};

	const colorClasses = {
		success: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200',
		error: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200',
		warning:
			'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200',
		info: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200',
		loading: 'bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-900 dark:text-slate-200'
	};
</script>

<div class="fixed top-4 right-4 z-50 space-y-2">
	{#each $toastStore as toast (toast.id)}
		<div
			transition:fly={{ x: 300, duration: 300 }}
			class="flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-[300px] max-w-md {colorClasses[
				toast.type
			]}"
		>
			<span class="text-xl font-bold">
				{#if toast.type === 'loading'}
					<svg
						class="animate-spin h-5 w-5"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
				{:else}
					{icons[toast.type]}
				{/if}
			</span>
			<p class="flex-1 text-sm font-medium">{toast.message}</p>
			<button
				onclick={() => toastStore.remove(toast.id)}
				aria-label="Close notification"
				class="text-current opacity-70 hover:opacity-100 transition-opacity"
			>
				<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		</div>
	{/each}
</div>
