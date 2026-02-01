<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';
	import { formatDate } from '$lib/utils/helpers';
	import type { PageData } from './$types';
    import PageTitle from '$lib/components/PageTitle.svelte';
    import StickyHeader from '$lib/components/StickyHeader.svelte';
    import * as Card from "$lib/components/ui/card";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { Badge } from "$lib/components/ui/badge";
    import { Key, Plus, Trash2, Copy, Check } from "lucide-svelte";

	let { data }: { data: PageData } = $props();

	let showAddModal = $state(false);
	let showTokenModal = $state(false);
	let name = $state('');
	let permissions = $state<string[]>(['read']);
	let isCreating = $state(false);
	let newToken = $state('');
    let copied = $state(false);

	function togglePermission(permission: string, checked: boolean) {
		if (checked) {
            if (!permissions.includes(permission)) {
			    permissions.push(permission);
            }
		} else {
			permissions = permissions.filter(p => p !== permission);
		}
	}

	async function handleCreate() {
		if (!name) return;
		isCreating = true;
		try {
			const response = (await api.post('/security/api-tokens', { name, permissions })) as any;
			newToken = response.data.data.token;
			toastStore.success('API token created');
			showAddModal = false;
            showTokenModal = true;
			name = '';
            permissions = ['read'];
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to create token');
		} finally {
			isCreating = false;
		}
	}

	async function handleDelete(id: string) {
		if (!confirm('Revoke this token permanently?')) return;
		try {
			await api.delete(`/security/api-tokens/${id}`);
			toastStore.success('Token revoked');
			window.location.reload();
		} catch (error: any) {
			toastStore.error(error.response?.data?.message || 'Failed to revoke token');
		}
	}

    function copyToken() {
        navigator.clipboard.writeText(newToken);
        copied = true;
        setTimeout(() => copied = false, 2000);
        toastStore.success('Token copied to clipboard');
    }
</script>

<PageTitle title="API Tokens" />

<div class="space-y-6">
	<StickyHeader class="space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">Security</h1>
				<p class="text-muted-foreground mt-1">Manage your secure credentials and access tokens.</p>
			</div>
			<Button onclick={() => (showAddModal = true)}>
				<Plus class="size-4 mr-2" />
				New Token
			</Button>
		</div>

		<nav class="flex gap-4 border-b">
			<a href="/security/private-key" class="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Private Keys</a>
			<a href="/security/api-tokens" class="px-4 py-2 text-sm font-medium border-b-2 border-primary">API Tokens</a>
		</nav>
	</StickyHeader>

	<div class="grid gap-4">
        {#if data.apiTokens.length === 0}
            <div class="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-lg bg-muted/10">
                <Key class="size-10 text-muted-foreground/50 mb-4" />
                <h3 class="font-semibold text-lg">No Active Tokens</h3>
                <p class="text-muted-foreground text-sm max-w-sm text-center mt-1 mb-6">
                    Create API tokens to authenticate external tools and scripts.
                </p>
                <Button variant="outline" onclick={() => (showAddModal = true)}>Generate Token</Button>
            </div>
        {:else}
            <div class="rounded-md border">
                <div class="grid grid-cols-12 gap-4 p-4 font-medium text-sm text-muted-foreground border-b bg-muted/30">
                    <div class="col-span-4 pl-2">Description</div>
                    <div class="col-span-4">Permissions</div>
                    <div class="col-span-3">Last Used</div>
                    <div class="col-span-1 text-right">Actions</div>
                </div>
                {#each data.apiTokens as token}
                    <div class="grid grid-cols-12 gap-4 p-4 items-center text-sm border-b last:border-0 hover:bg-muted/10 transition-colors">
                        <div class="col-span-4 pl-2 font-medium flex items-center gap-2">
                            <Key class="size-4 text-muted-foreground" />
                            {token.name}
                        </div>
                        <div class="col-span-4 flex flex-wrap gap-1">
                            <Badge variant="secondary" class="font-mono text-[10px]">read</Badge>
                            <!-- Mock permissions display since we don't store them in this view yet -->
                            <Badge variant="outline" class="font-mono text-[10px] text-muted-foreground">+others</Badge>
                        </div>
                        <div class="col-span-3 text-muted-foreground text-xs">
                            {token.lastUsedAt ? formatDate(token.lastUsedAt.toString()) : 'Never used'}
                        </div>
                        <div class="col-span-1 flex justify-end">
                            <Button variant="ghost" size="icon" class="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8" onclick={() => handleDelete(token.id)}>
                                <Trash2 class="size-4" />
                            </Button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
	</div>
</div>

<!-- Create Token Modal -->
<Dialog.Root bind:open={showAddModal}>
    <Dialog.Content class="sm:max-w-[500px]">
        <Dialog.Header>
            <Dialog.Title>Generate API Token</Dialog.Title>
            <Dialog.Description>Create a new token for programmatic access.</Dialog.Description>
        </Dialog.Header>
        <form onsubmit={(e) => { e.preventDefault(); handleCreate(); }} class="space-y-6 pt-4">
            <div class="space-y-2">
                <Label for="name">Token Description</Label>
                <Input id="name" bind:value={name} placeholder="e.g. CI/CD Pipeline" required />
            </div>
            
            <div class="space-y-3">
                <Label>Permissions</Label>
                <div class="grid gap-3 border rounded-md p-4">
                    <div class="flex items-start space-x-3">
                        <Checkbox id="perm-root" 
                            checked={permissions.includes('root')} 
                            onCheckedChange={(v) => togglePermission('root', !!v)} />
                        <div class="grid gap-1.5 leading-none">
                            <Label for="perm-root" class="font-medium">Root Access</Label>
                            <p class="text-xs text-muted-foreground">Full administrative control. Use with caution.</p>
                        </div>
                    </div>
                    
                    {#if !permissions.includes('root')}
                        <div class="h-px bg-border my-1"></div>
                        
                        <div class="flex items-center space-x-3">
                            <Checkbox id="perm-read" checked={true} disabled />
                            <Label for="perm-read" class="text-sm font-normal">Read-only (Default)</Label>
                        </div>

                        <div class="flex items-center space-x-3">
                            <Checkbox id="perm-deploy" 
                                checked={permissions.includes('deploy')} 
                                onCheckedChange={(v) => togglePermission('deploy', !!v)} />
                            <Label for="perm-deploy" class="text-sm font-normal">Deploy Applications</Label>
                        </div>

                        <div class="flex items-center space-x-3">
                            <Checkbox id="perm-write" 
                                checked={permissions.includes('write')} 
                                onCheckedChange={(v) => togglePermission('write', !!v)} />
                            <Label for="perm-write" class="text-sm font-normal">Write / configuration</Label>
                        </div>
                        
                        <div class="flex items-center space-x-3">
                            <Checkbox id="perm-sensitive" 
                                checked={permissions.includes('read:sensitive')} 
                                onCheckedChange={(v) => togglePermission('read:sensitive', !!v)} />
                            <Label for="perm-sensitive" class="text-sm font-normal">Read Sensitive Data</Label>
                        </div>
                    {/if}
                </div>
            </div>

            <Dialog.Footer>
                <Button type="button" variant="outline" onclick={() => showAddModal = false}>Cancel</Button>
                <Button type="submit" disabled={isCreating}>
                    {isCreating ? 'Generating...' : 'Generate Token'}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<!-- Token Display Modal -->
<Dialog.Root bind:open={showTokenModal}>
    <Dialog.Content class="sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title class="text-green-600 dark:text-green-500 flex items-center gap-2">
                <Check class="size-5" />
                Token Generated Successfully
            </Dialog.Title>
            <Dialog.Description>
                Copy this token now. It will not be shown again.
            </Dialog.Description>
        </Dialog.Header>
        
        <div class="flex items-center space-x-2 pt-4">
            <div class="grid flex-1 gap-2">
                <Label for="token" class="sr-only">Token</Label>
                <div class="relative">
                    <Input id="token" defaultValue={newToken} readonly class="font-mono text-sm pr-10 bg-muted/40" />
                </div>
            </div>
            <Button size="icon" variant="outline" class="px-3" onclick={copyToken}>
                {#if copied}
                    <Check class="size-4" />
                {:else}
                    <Copy class="size-4" />
                {/if}
            </Button>
        </div>

        <Dialog.Footer class="sm:justify-start">
            <Button type="button" variant="secondary" class="w-full" onclick={() => {
                showTokenModal = false;
                window.location.reload();
            }}>
                I have copied it
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
