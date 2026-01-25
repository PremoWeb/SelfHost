<script lang="ts">
	import { goto } from '$app/navigation';
	import { toastStore } from '$lib/stores/toast';
	import { authClient } from '$lib/auth-client';
	import { User, Mail, Lock, Loader2, ArrowRight, ShieldCheck, Rocket } from '@lucide/svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let passwordConfirmation = $state('');
	let errors = $state<Record<string, string | string[]>>({});
	let isLoading = $state(false);

	async function handleRegister(event: SubmitEvent) {
		event.preventDefault();
		isLoading = true;
		errors = {};

		// Client-side validation
		if (password !== passwordConfirmation) {
			errors.password = 'Passwords do not match';
			isLoading = false;
			return;
		}

		if (password.length < 8) {
			errors.password = 'Password must be at least 8 characters';
			isLoading = false;
			return;
		}

		await authClient.signUp.email(
			{
				email,
				password,
				name
			},
			{
				onSuccess: () => {
					toastStore.success(`Welcome, ${name}!`);
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

	function getError(field: string): string | undefined {
		const err = errors[field];
		if (Array.isArray(err)) return err[0];
		return err as string | undefined;
	}
</script>

<PageTitle title="Register | SelfHost" />

<div
	class="bg-background relative flex min-h-screen items-center justify-center overflow-hidden font-sans"
>
	<!-- Dynamic Background -->
	<div class="absolute inset-0 z-0">
		<div
			class="bg-primary/5 absolute top-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full blur-[120px]"
		></div>
		<div
			class="bg-primary/5 absolute bottom-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full blur-[120px]"
		></div>
	</div>

	<div class="z-10 w-full max-w-md px-6 py-12">
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
			<p class="text-muted-foreground font-medium opacity-80">
				Start your self-hosting journey today.
			</p>
		</div>

		<!-- Register Card -->
		<div
			class="bg-card border-border/50 animate-in fade-in zoom-in-95 rounded-3xl border p-8 shadow-2xl backdrop-blur-xl duration-700"
		>
			<form onsubmit={handleRegister} class="space-y-5">
				<!-- Name Field -->
				<div class="space-y-1.5">
					<label for="name" class="ml-1 block text-sm font-semibold">Full Name</label>
					<div class="group relative">
						<div
							class="text-muted-foreground group-focus-within:text-primary pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 transition-colors"
						>
							<User size={18} />
						</div>
						<input
							id="name"
							type="text"
							bind:value={name}
							required
							placeholder="John Doe"
							class="bg-muted/30 border-border/50 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/50 block w-full rounded-xl border py-3 pr-4 pl-11 outline-hidden transition-all focus:ring-2"
						/>
					</div>
					{#if getError('name')}
						<p class="text-destructive mt-1 ml-1 text-xs font-medium">{getError('name')}</p>
					{/if}
				</div>

				<!-- Email Field -->
				<div class="space-y-1.5">
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
					{#if getError('email')}
						<p class="text-destructive mt-1 ml-1 text-xs font-medium">{getError('email')}</p>
					{/if}
				</div>

				<!-- Password Field -->
				<div class="space-y-1.5">
					<label for="password" class="ml-1 block text-sm font-semibold">Password</label>
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
					{#if getError('password')}
						<p class="text-destructive mt-1 ml-1 text-xs font-medium">{getError('password')}</p>
					{/if}
				</div>

				<!-- Confirm Password Field -->
				<div class="space-y-1.5">
					<label for="password_confirmation" class="ml-1 block text-sm font-semibold"
						>Confirm Password</label
					>
					<div class="group relative">
						<div
							class="text-muted-foreground group-focus-within:text-primary pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 transition-colors"
						>
							<Lock size={18} />
						</div>
						<input
							id="password_confirmation"
							type="password"
							bind:value={passwordConfirmation}
							required
							placeholder="••••••••"
							class="bg-muted/30 border-border/50 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/50 block w-full rounded-xl border py-3 pr-4 pl-11 outline-hidden transition-all focus:ring-2"
						/>
					</div>
				</div>

				<!-- Submit Button -->
				<button
					type="submit"
					disabled={isLoading}
					class="bg-primary text-primary-foreground shadow-primary/20 hover:shadow-primary/30 group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-bold shadow-lg transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
				>
					{#if isLoading}
						<Loader2 class="size-5 animate-spin" />
						Creating...
					{:else}
						Create Account
						<ArrowRight class="size-4 transition-transform group-hover:translate-x-1" />
					{/if}
				</button>
			</form>

			<div class="text-muted-foreground mt-8 text-center text-sm font-medium">
				Already have an account?
				<a href="/login" class="text-primary ml-1 decoration-2 underline-offset-4 hover:underline">
					Sign in instead
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
			</div>
		</div>
	</div>
</div>

<style>
	:global(body) {
		background-color: var(--background);
	}
</style>
