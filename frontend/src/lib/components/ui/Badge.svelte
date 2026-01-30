<script lang="ts">
	interface Props {
		variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
		rounded?: boolean;
		children: any;
	}

	let { variant = 'primary', rounded = false, children }: Props = $props();

	const variants = {
		primary: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
		secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
		success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
		warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
		error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
		info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
	};
</script>

<span
	class="inline-flex items-center px-2.5 py-0.5 text-xs font-medium {rounded
		? 'rounded-full'
		: 'rounded'} {variants[variant]}"
>
	{@render children()}
</span>
