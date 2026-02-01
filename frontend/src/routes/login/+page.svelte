<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { toastStore } from '$lib/stores/toast';
	import { authClient } from '$lib/auth-client';
	import { Mail, Lock, Loader2, ArrowRight, ShieldCheck, Rocket, ArrowLeft } from 'lucide-svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let email = $state('');
	let password = $state('');
	let errors = $state<Record<string, string>>({});
	let isLoading = $state(false);
	let mounted = $state(false);
	
	const websiteMode = $derived((data as any)?.websiteMode ?? false);
	
	// Debug: Check if data is loading correctly
	$effect(() => {
		if (mounted && data) {
			console.log('[Login] websiteMode from data:', (data as any)?.websiteMode, 'Full data:', data);
		}
	});

	onMount(() => {
		mounted = true;
	});

	async function handleLogin(event: SubmitEvent) {
		event.preventDefault();
		isLoading = true;
		errors = {};

		await authClient.signIn.email(
			{
				email,
				password
			},
			{
				onSuccess: () => {
					toastStore.success('Welcome back!');
					goto('/');
				},
				onError: (ctx) => {
					toastStore.error(ctx.error.message);
					isLoading = false;
				},
				onRequest: () => {
					isLoading = true;
				}
			}
		);
	}
</script>

<PageTitle title="Login | SelfHost" />

{#if mounted}
<div
	class="bg-background relative flex min-h-screen items-center justify-center overflow-hidden font-sans"
>
	<!-- Dynamic Background -->
	<div class="absolute inset-0 z-0">
		<div
			class="bg-primary/5 absolute top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full blur-[120px]"
		></div>
		<div
			class="bg-primary/5 absolute right-[-10%] bottom-[-10%] h-[40%] w-[40%] rounded-full blur-[120px]"
		></div>
	</div>

	<div class="z-10 w-full max-w-md px-6">
		<!-- Logo Section -->
		<div
			class="animate-in fade-in slide-in-from-bottom-4 mb-10 space-y-2 text-center duration-1000"
		>
			<div
				class="bg-primary text-primary-foreground shadow-primary/20 mb-4 inline-flex items-center justify-center rounded-2xl p-3 shadow-2xl"
			>
				<ShieldCheck size={32} />
			</div>
			<h1
				class="from-foreground to-foreground/70 bg-linear-to-b bg-clip-text text-4xl font-black tracking-tight text-transparent uppercase"
			>
				SelfHost
			</h1>
			<p class="text-muted-foreground font-medium opacity-80">Your infrastructure, your control.</p>
		</div>

		<!-- Login Card -->
		<div
			class="bg-card border-border/50 animate-in fade-in zoom-in-95 rounded-3xl border p-8 shadow-2xl backdrop-blur-xl duration-700"
		>
			<div class="mb-6 -mt-2">
				<a
					href="/"
					class="text-muted-foreground hover:text-foreground group inline-flex items-center gap-2 text-sm font-medium transition-colors"
				>
					<ArrowLeft class="size-4 transition-transform group-hover:-translate-x-1" />
					Go back to site
				</a>
			</div>
			<form onsubmit={handleLogin} class="space-y-6">
				<!-- Email Field -->
				<div class="space-y-2">
					<label for="email" class="ml-1 block text-sm font-semibold">Email Address</label>
					<div class="group relative">
						<div
							class="text-muted-foreground group-focus-within:text-primary pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 transition-colors"
						>
							<Mail size={18} />
						</div>
						<input
							id="email"
							type="email"
							bind:value={email}
							required
							placeholder="name@company.com"
							class="bg-muted/30 border-border/50 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/50 block w-full rounded-xl border py-3 pr-4 pl-11 outline-hidden transition-all focus:ring-2"
						/>
					</div>
					{#if errors.email}
						<p class="text-destructive mt-1 ml-1 text-xs font-medium">{errors.email}</p>
					{/if}
				</div>

				<!-- Password Field -->
				<div class="space-y-2">
					<div class="ml-1 flex items-center justify-between">
						<label for="password" class="block text-sm font-semibold">Password</label>
						<a
							href="/forgot-password"
							class="text-primary/70 hover:text-primary text-xs font-bold transition-colors"
						>
							Forgot?
						</a>
					</div>
					<div class="group relative">
						<div
							class="text-muted-foreground group-focus-within:text-primary pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 transition-colors"
						>
							<Lock size={18} />
						</div>
						<input
							id="password"
							type="password"
							bind:value={password}
							required
							placeholder="••••••••"
							class="bg-muted/30 border-border/50 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/50 block w-full rounded-xl border py-3 pr-4 pl-11 outline-hidden transition-all focus:ring-2"
						/>
					</div>
					{#if errors.password}
						<p class="text-destructive mt-1 ml-1 text-xs font-medium">{errors.password}</p>
					{/if}
				</div>

				<!-- Remember Me -->
				<div class="ml-1 flex items-center space-x-2">
					<input
						id="remember"
						type="checkbox"
						class="border-border bg-muted/30 text-primary focus:ring-primary/20 h-4 w-4 rounded"
					/>
					<label for="remember" class="text-muted-foreground text-sm font-medium"
						>Stay signed in for 30 days</label
					>
				</div>

				<!-- Submit Button -->
				<button
					type="submit"
					disabled={isLoading}
					class="bg-primary text-primary-foreground shadow-primary/20 hover:shadow-primary/30 group inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-bold shadow-lg transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
				>
					{#if isLoading}
						<Loader2 class="size-5 animate-spin" />
						Verifying...
					{:else}
						Sign In
						<ArrowRight class="size-4 transition-transform group-hover:translate-x-1" />
					{/if}
				</button>
			</form>

			<div class="text-muted-foreground mt-8 text-center text-sm font-medium">
				Don't have an account?
				<a
					href="/register"
					class="text-primary ml-1 decoration-2 underline-offset-4 hover:underline"
				>
					Create one now
				</a>
			</div>
		</div>

		<!-- Footer Info -->
		<div
			class="animate-in fade-in fill-mode-both mt-12 space-y-4 text-center delay-500 duration-1000"
		>
			<div
				class="text-muted-foreground flex items-center justify-center gap-6 opacity-50 grayscale transition-all hover:grayscale-0"
			>
				<div class="flex items-center gap-2">
					<Rocket size={16} />
					<span class="text-xs font-bold tracking-widest uppercase">Svelte 5</span>
				</div>
				<div class="bg-border h-1 w-1 rounded-full"></div>
				<div class="flex items-center gap-2">
					<ShieldCheck size={16} />
					<span class="text-xs font-bold tracking-widest uppercase">Secure</span>
				</div>
			</div>

			<div class="border-border/50 border-t pt-6">
				<p
					class="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase opacity-60"
				>
					Powered by Full-Stack SvelteKit Architecture
				</p>
				<p class="text-muted-foreground/40 mt-1 text-[10px] font-medium italic">
					Unified Environment • Direct DB Access • Edge Optimized
				</p>
			</div>
		</div>
	</div>
</div>
{/if}

<style>
	:global(body) {
		background-color: var(--background);
	}
</style>
