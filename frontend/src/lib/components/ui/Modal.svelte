<script lang="ts">
	import { fade, scale } from 'svelte/transition';
    import Button from '$lib/components/forms/Button.svelte';

	interface Props {
		open: boolean;
		title?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		children: any;
        footer?: any;
		onclose?: () => void;
	}

	let { open = $bindable(false), title, size = 'md', children, footer, onclose }: Props = $props();

	function close() {
		open = false;
		onclose?.();
	}

    function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			close();
		}
	}

	const sizes = {
		sm: 'sm:max-w-sm',
		md: 'sm:max-w-md',
		lg: 'sm:max-w-lg',
		xl: 'sm:max-w-xl'
	};
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
		<!-- Backdrop -->
		<div
			class="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/80 transition-opacity"
			aria-hidden="true"
			transition:fade={{ duration: 200 }}
            onclick={close}
		></div>

		<div class="fixed inset-0 z-10 w-screen overflow-y-auto">
			<div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
				<!-- Panel -->
				<div
					class="relative transform overflow-hidden rounded-lg bg-white dark:bg-base text-left shadow-xl transition-all sm:my-8 w-full {sizes[
						size
					]}"
					transition:scale={{ duration: 200, start: 0.95 }}
				>
					<div class="px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
						{#if title}
							<div class="sm:flex sm:items-start mb-4">
								<h3 class="text-lg font-semibold leading-6 text-gray-900 dark:text-white" id="modal-title">
									{title}
								</h3>
							</div>
						{/if}
						<div class="mt-2 text-sm text-gray-500 dark:text-gray-300">
							{@render children()}
						</div>
					</div>
					{#if footer}
						<div class="bg-gray-50 dark:bg-coolgray-100 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-2">
							{@render footer()}
						</div>
                    {:else}
                         <div class="bg-gray-50 dark:bg-coolgray-100 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                            <Button variant="secondary" onclick={close}>Close</Button>
                        </div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
