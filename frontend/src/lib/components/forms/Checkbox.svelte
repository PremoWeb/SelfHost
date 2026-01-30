<script lang="ts">
	interface Props {
		label: string;
		name?: string;
		checked?: boolean;
		disabled?: boolean;
		helper?: string;
		onchange?: (e: Event) => void;
	}

	let { label, name, checked = false, disabled = false, helper, onchange }: Props = $props();
</script>

<div class="flex items-start">
	<div class="flex items-center h-5">
		<input
			id={name || label}
			{name}
			type="checkbox"
			{checked}
			{disabled}
			{onchange}
			class="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
		/>
	</div>
	<div class="ms-2 text-sm">
		<label for={name || label} class="font-medium text-gray-900 dark:text-gray-300 {disabled ? 'opacity-50 cursor-not-allowed' : ''}">
			{label}
		</label>
		{#if helper}
			<p class="text-xs font-normal text-gray-500 dark:text-gray-400 {disabled ? 'opacity-50' : ''}">
				{helper}
			</p>
		{/if}
	</div>
</div>
