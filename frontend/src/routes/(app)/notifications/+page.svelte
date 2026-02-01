<script lang="ts">
    import { enhance } from '$app/forms';
    import { toastStore } from '$lib/stores/toast';
    import type { PageData } from './$types';
    import * as Tabs from "$lib/components/ui/tabs";
    import * as Card from "$lib/components/ui/card";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Button } from "$lib/components/ui/button";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { Badge } from "$lib/components/ui/badge";
    import PageTitle from '$lib/components/PageTitle.svelte';
    import StickyHeader from '$lib/components/StickyHeader.svelte';
    import { Plus, Trash2, Edit, Bell } from "lucide-svelte";

    let { data }: { data: PageData } = $props();

    let channels = $derived(data.channels as any[]);
    let isModalOpen = $state(false);
    let editingChannel = $state<any>(null); // Use a type if available

    // Form states
    let formData = $state({
        id: '',
        name: '',
        type: 'email',
        enabled: true,
        // Email
        emailProvider: 'smtp',
        smtpFromAddress: '',
        smtpFromName: '',
        smtpRecipients: '',
        smtpHost: '',
        smtpPort: '587',
        smtpUsername: '',
        smtpPassword: '',
        smtpTimeout: '30',
        resendApiKey: '',
        sendgridApiKey: '',
        // Discord
        discordWebhookUrl: '',
        // Telegram
        telegramBotToken: '',
        telegramChatId: '',
        // Events
        events: {
            deploymentSuccess: false,
            deploymentFailure: true,
            statusChange: true,
            backupSuccess: false,
            backupFailure: true,
            scheduledTaskSuccess: false,
            scheduledTaskFailure: true,
            serverDiskUsage: true
        } as Record<string, boolean>
    });

    const eventTypes = [
        { id: 'deploymentSuccess', label: 'Deployment Success' },
        { id: 'deploymentFailure', label: 'Deployment Failure' },
        { id: 'statusChange', label: 'Status Change' },
        { id: 'backupSuccess', label: 'Backup Success' },
        { id: 'backupFailure', label: 'Backup Failure' },
        { id: 'scheduledTaskSuccess', label: 'Scheduled Task Success' },
        { id: 'scheduledTaskFailure', label: 'Scheduled Task Failure' },
        { id: 'serverDiskUsage', label: 'Server Disk Usage' },
    ];

    function openModal(channel: any = null) {
        editingChannel = channel;
        if (channel) {
            formData = {
                id: channel.id,
                name: channel.name,
                type: channel.type,
                enabled: channel.enabled,
                
                // Defaults
                emailProvider: channel.config?.provider || 'smtp',
                smtpFromAddress: channel.config?.smtpFromAddress || '',
                smtpFromName: channel.config?.smtpFromName || '',
                smtpRecipients: channel.config?.smtpRecipients || '',
                smtpHost: channel.config?.smtpHost || '',
                smtpPort: channel.config?.smtpPort || '587',
                smtpUsername: channel.config?.smtpUsername || '',
                smtpPassword: channel.config?.smtpPassword || '',
                smtpTimeout: channel.config?.smtpTimeout || '30',
                resendApiKey: channel.config?.resendApiKey || '',
                sendgridApiKey: channel.config?.sendgridApiKey || '',
                
                discordWebhookUrl: channel.config?.webhookUrl || '',
                
                telegramBotToken: channel.config?.botToken || '',
                telegramChatId: channel.config?.chatId || '',

                events: { ...formData.events, ...channel.events }
            };
        } else {
            // Reset form for new channel
            formData = {
                id: '',
                name: '',
                type: 'email',
                enabled: true,
                emailProvider: 'smtp',
                smtpFromAddress: '',
                smtpFromName: '',
                smtpRecipients: '',
                smtpHost: '',
                smtpPort: '587',
                smtpUsername: '',
                smtpPassword: '',
                smtpTimeout: '30',
                resendApiKey: '',
                sendgridApiKey: '',
                discordWebhookUrl: '',
                telegramBotToken: '',
                telegramChatId: '',
                events: {
                    deploymentSuccess: false,
                    deploymentFailure: true,
                    statusChange: true,
                    backupSuccess: false,
                    backupFailure: true,
                    scheduledTaskSuccess: false,
                    scheduledTaskFailure: true,
                    serverDiskUsage: true
                }
            };
        }
        isModalOpen = true;
    }

    $effect(() => {
        // Auto-detect Gmail
        const isGmail = formData.smtpUsername?.includes('@gmail.com') || formData.smtpFromAddress?.includes('@gmail.com');
        if (formData.type === 'email' && isGmail && formData.emailProvider !== 'gmail') {
            formData.emailProvider = 'gmail';
        }

        if (formData.emailProvider === 'gmail') {
            formData.smtpHost = 'smtp.gmail.com';
            formData.smtpPort = '465'; 
            if (formData.smtpUsername) {
                formData.smtpFromAddress = formData.smtpUsername;
            }
        }
    });
</script>

<PageTitle title="Notifications" />

<div class="space-y-6">
    <StickyHeader>
        <div class="flex items-center justify-between">
            <div class="flex flex-col gap-1">
                <h1 class="text-3xl font-bold tracking-tight">Notifications</h1>
                <p class="text-muted-foreground">Configure multiple notification channels for different events or teams.</p>
            </div>
            <Button onclick={() => openModal()}>
                <Plus class="mr-2 size-4" />
                Add Channel
            </Button>
        </div>
    </StickyHeader>

    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {#each channels as channel}
            <Card.Root>
                <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Card.Title class="text-lg font-medium">
                        {channel.name}
                    </Card.Title>
                    <Badge variant={channel.enabled ? "default" : "secondary"}>
                        {channel.type}
                    </Badge>
                </Card.Header>
                <Card.Content>
                    <div class="text-xs text-muted-foreground mb-4">
                        {#if channel.type === 'email'}
                            Provider: {channel.config.provider}
                        {:else if channel.type === 'discord'}
                            Webhook Configured
                        {:else if channel.type === 'telegram'}
                            Bot Configured
                        {/if}
                    </div>
                    <div class="space-y-2">
                         <div class="flex flex-wrap gap-1">
                            {#each Object.entries(channel.events) as [key, enabled]}
                                {#if enabled}
                                    <Badge variant="outline" class="text-[10px] px-1 py-0 h-5">{key}</Badge>
                                {/if}
                            {/each}
                         </div>
                    </div>
                </Card.Content>
                <Card.Footer class="flex justify-between border-t p-4">
                    <div class="flex gap-2">
                        <Button variant="outline" size="sm" onclick={() => openModal(channel)}>
                            <Edit class="size-4 mr-2" /> Edit
                        </Button>
                        <form method="POST" action="?/deleteChannel" use:enhance={() => {
                            return async ({ result, update }) => {
                                if (result.type === 'success') {
                                    toastStore.success('Channel deleted');
                                    await update();
                                }
                                else toastStore.error('Failed to delete channel');
                            };
                        }}>
                            <input type="hidden" name="id" value={channel.id} />
                            <Button type="submit" variant="destructive" size="sm">
                                <Trash2 class="size-4" />
                            </Button>
                        </form>
                    </div>
                </Card.Footer>
            </Card.Root>
        {/each}
        
        {#if channels.length === 0}
            <div class="col-span-full flex h-[200px] w-full flex-col items-center justify-center rounded-md border border-dashed text-muted-foreground">
                <Bell class="mb-4 size-10 opacity-50" />
                <p>No channels configured.</p>
                <Button variant="link" onclick={() => openModal()}>Create your first one</Button>
            </div>
        {/if}
    </div>
</div>

<Dialog.Root bind:open={isModalOpen}>
    <Dialog.Content class="max-w-2xl max-h-[90vh] overflow-y-auto">
        <Dialog.Header>
            <Dialog.Title>{editingChannel ? 'Edit Channel' : 'New Notification Channel'}</Dialog.Title>
            <Dialog.Description>
                Configure the channel settings and triggers.
            </Dialog.Description>
        </Dialog.Header>

        <form method="POST" action="?/saveChannel" class="space-y-6" use:enhance={() => {
            return async ({ result, update }) => {
                if (result.type === 'success') {
                    toastStore.success('Channel saved');
                    isModalOpen = false;
                    await update();
                }
                else toastStore.error('Failed to save channel');
            };
        }}>
            <input type="hidden" name="id" value={formData.id} />
            
            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                    <Label for="name">Channel Name</Label>
                    <Input id="name" name="name" bind:value={formData.name} placeholder="e.g. DevOps Alerts" required />
                </div>
                <div class="space-y-2">
                    <Label for="type">Type</Label>
                    <!-- Simple select for now -->
                    <select id="type" name="type" bind:value={formData.type} class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                        <option value="email">Email</option>
                        <option value="discord">Discord</option>
                        <option value="telegram">Telegram</option>
                    </select>
                </div>
            </div>

            <div class="flex items-center space-x-2">
                <Checkbox id="enabled" name="enabled" bind:checked={formData.enabled} />
                <Label for="enabled">Enabled</Label>
            </div>

            <div class="border rounded-md p-4 bg-secondary/10 space-y-4">
                <h3 class="font-medium">Configuration</h3>
                
                {#if formData.type === 'email'}
                    <div class="space-y-2">
                        <Label>Email Provider</Label>
                         <select id="emailProvider" name="emailProvider" bind:value={formData.emailProvider} class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                            <option value="smtp">SMTP</option>
                            <option value="gmail">Gmail</option>
                            <option value="resend">Resend</option>
                            <option value="sendgrid">SendGrid</option>
                        </select>
                    </div>

                    {#if formData.emailProvider === 'smtp' || formData.emailProvider === 'gmail'}
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-2"><Label>From Address</Label><Input name="smtpFromAddress" bind:value={formData.smtpFromAddress} /></div>
                            <div class="space-y-2"><Label>From Name</Label><Input name="smtpFromName" bind:value={formData.smtpFromName} /></div>
                            <div class="space-y-2"><Label>Host</Label><Input name="smtpHost" bind:value={formData.smtpHost} /></div>
                            <div class="space-y-2"><Label>Port</Label><Input name="smtpPort" bind:value={formData.smtpPort} /></div>
                            <div class="space-y-2"><Label>Username</Label><Input name="smtpUsername" bind:value={formData.smtpUsername} /></div>
                            <div class="space-y-2"><Label>Password</Label><Input type="password" name="smtpPassword" bind:value={formData.smtpPassword} placeholder={editingChannel ? "Leave blank to keep unchanged" : ""} /></div>
                            <div class="space-y-2 col-span-2"><Label>Recipients</Label><Input name="smtpRecipients" bind:value={formData.smtpRecipients} /></div>
                        </div>
                    {:else if formData.emailProvider === 'resend'}
                        <div class="space-y-2"><Label>Resend API Key</Label><Input type="password" name="resendApiKey" bind:value={formData.resendApiKey} placeholder={editingChannel ? "Leave blank to keep unchanged" : ""} /></div>
                        <div class="space-y-2"><Label>Recipients</Label><Input name="smtpRecipients" bind:value={formData.smtpRecipients} placeholder="Optional override" /></div>
                    {:else if formData.emailProvider === 'sendgrid'}
                         <div class="space-y-2"><Label>SendGrid API Key</Label><Input type="password" name="sendgridApiKey" bind:value={formData.sendgridApiKey} placeholder={editingChannel ? "Leave blank to keep unchanged" : ""} /></div>
                    {/if}

                {:else if formData.type === 'discord'}
                    <div class="space-y-2">
                        <Label>Webhook URL</Label>
                        <Input name="discordWebhookUrl" bind:value={formData.discordWebhookUrl} placeholder="https://discord.com/api/webhooks/..." />
                    </div>

                {:else if formData.type === 'telegram'}
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2"><Label>Bot Token</Label><Input type="password" name="telegramBotToken" bind:value={formData.telegramBotToken} placeholder={editingChannel ? "Leave blank to keep unchanged" : ""} /></div>
                        <div class="space-y-2"><Label>Chat ID</Label><Input name="telegramChatId" bind:value={formData.telegramChatId} /></div>
                    </div>
                {/if}
            </div>

            <div class="border rounded-md p-4 bg-secondary/10 space-y-4">
                <h3 class="font-medium">Triggers</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {#each eventTypes as event}
                        <div class="flex items-center space-x-2">
                            <Checkbox id={event.id} name={event.id} bind:checked={formData.events[event.id]} />
                            <Label for={event.id}>{event.label}</Label>
                        </div>
                    {/each}
                </div>
            </div>

            <Dialog.Footer>
                <Button type="button" variant="outline" onclick={() => isModalOpen = false}>Cancel</Button>
                <Button type="submit">Save Channel</Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>
