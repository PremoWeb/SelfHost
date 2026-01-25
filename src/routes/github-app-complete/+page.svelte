<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import { completeGitHubApp } from '../(app)/github.remote';

	let isCompleting = $state(true);

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		const token = params.get('token');
		
		if (!token) {
			toastStore.error('Invalid registration token');
			goto('/sources');
			return;
		}

		try {
			// Exchange the token for the GitHub App registration
			const response = await completeGitHubApp({ token });

			if (!response.success) {
				throw new Error(response.message || 'Failed to complete registration');
			}

			toastStore.success('GitHub App registered successfully!');
			goto('/sources');
		} catch (error: any) {
			toastStore.error(error.message || 'Failed to complete GitHub App registration');
			goto('/sources');
		}
	});
</script>

<div class="min-h-screen flex items-center justify-center">
	<div class="text-center">
		<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
		<h2 class="text-xl font-semibold">Completing GitHub App registration...</h2>
		<p class="text-muted-foreground mt-2">Please wait while we finalize your setup.</p>
	</div>
</div>
