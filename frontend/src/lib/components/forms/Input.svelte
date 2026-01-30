<script lang="ts">
	interface Props {
		id: string;
		name: string;
		label?: string;
		type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'search';
		value?: string | number;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		readonly?: boolean;
		error?: string;
		helpText?: string;
		oninput?: (event: Event & { currentTarget: EventTarget & HTMLInputElement }) => void;
		[key: string]: any;
	}

	let {
		id,
		name,
		label,
		type = 'text',
		value = $bindable(''),
		placeholder,
		required = false,
		disabled = false,
		readonly = false,
		error,
		helpText,
		...rest
	}: Props = $props();
</script>

<div class="mb-4">
	{#if label}
		<label for={id} class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
			{label}
			{#if required}
				<span class="text-red-500">*</span>
			{/if}
		</label>
	{/if}

	<input
		{id}
		{name}
		{type}
		bind:value
		{placeholder}
		{required}
		{disabled}
		{readonly}
		{...rest}
		class="block w-full rounded-md border-gray-300 shadow-sm 
		       focus:border-indigo-500 focus:ring-indigo-500 
		       dark:bg-gray-800 dark:border-gray-600 dark:text-white
		       disabled:opacity-50 disabled:cursor-not-allowed
		       {error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}"
	/>

	{#if error}
		<p class="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
	{/if}

	{#if helpText && !error}
		<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{helpText}</p>
	{/if}
</div>
