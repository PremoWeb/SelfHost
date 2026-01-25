import { error, redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { notificationChannels } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth, isGod } from '$lib/server/auth/permissions';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await requireAuth(locals);
	
	// God users can access this page but won't have a team
	// Regular users need a team
	if (!locals.team && !(await isGod(locals.user!.id))) {
		throw error(400, 'Team required');
	}

    const channels = locals.team ? await db.query.notificationChannels.findMany({
        where: eq(notificationChannels.teamId, locals.team.id),
        orderBy: (channels, { desc }) => [desc(channels.createdAt)]
    }) : [];

    // Mask sensitive data
    const maskedChannels = channels.map(channel => {
        const config = { ...(channel.config as Record<string, any>) };
        if (config.smtpPassword) config.smtpPassword = '';
        if (config.resendApiKey) config.resendApiKey = '';
        if (config.sendgridApiKey) config.sendgridApiKey = '';
        if (config.botToken) config.botToken = '';
        if (config.webhookUrl) config.webhookUrl = ''; // Optional: mask webhook URL too if desired, though often visible
        return { ...channel, config };
    });

	return {
		channels: maskedChannels
	};
};

export const actions: Actions = {
    saveChannel: async ({ request, locals }) => {
        await requireAuth(locals);
        if (!locals.team) {
            return fail(400, { message: 'Team required for this operation' });
        }
        const formData = await request.formData();
        
        const id = formData.get('id') as string | null;
        
        // Fetch existing channel to preserve secrets if not updated
        let existingChannel: any = null;
        if (id) {
            existingChannel = await db.query.notificationChannels.findFirst({
                where: and(
                    eq(notificationChannels.id, id),
                    eq(notificationChannels.teamId, locals.team.id)
                )
            });
            if (!existingChannel) return fail(404, { message: 'Channel not found' });
        }

        const name = formData.get('name') as string;
        const type = formData.get('type') as string;
        const enabled = formData.get('enabled') === 'on';

        // Parse Config based on type
        const config: any = {};
        if (type === 'email') {
            config.provider = formData.get('emailProvider') as string; // smtp, resend, sendgrid, gmail
            if (config.provider === 'smtp' || config.provider === 'gmail') {
                config.smtpFromAddress = formData.get('smtpFromAddress');
                config.smtpFromName = formData.get('smtpFromName');
                config.smtpRecipients = formData.get('smtpRecipients');
                config.smtpHost = formData.get('smtpHost');
                config.smtpPort = parseInt(formData.get('smtpPort') as string) || 587;
                config.smtpUsername = formData.get('smtpUsername');
                
                const newPassword = formData.get('smtpPassword') as string;
                config.smtpPassword = newPassword ? newPassword : (existingChannel?.config?.smtpPassword || '');
                
                config.smtpTimeout = parseInt(formData.get('smtpTimeout') as string) || 30;
            } else if (config.provider === 'resend') {
                const newKey = formData.get('resendApiKey') as string;
                config.resendApiKey = newKey ? newKey : (existingChannel?.config?.resendApiKey || '');
            } else if (config.provider === 'sendgrid') {
                const newKey = formData.get('sendgridApiKey') as string;
                config.sendgridApiKey = newKey ? newKey : (existingChannel?.config?.sendgridApiKey || '');
            }
        } else if (type === 'discord') {
            const newUrl = formData.get('discordWebhookUrl') as string;
            config.webhookUrl = newUrl ? newUrl : (existingChannel?.config?.webhookUrl || '');
        } else if (type === 'telegram') {
            const newToken = formData.get('telegramBotToken') as string;
            config.botToken = newToken ? newToken : (existingChannel?.config?.botToken || '');
            config.chatId = formData.get('telegramChatId');
        }

        // Parse Events
        const events: any = {};
        const eventKeys = [
            'deploymentSuccess', 'deploymentFailure', 'statusChange', 
            'backupSuccess', 'backupFailure', 'scheduledTaskSuccess', 
            'scheduledTaskFailure', 'serverDiskUsage'
        ];
        
        for (const key of eventKeys) {
            events[key] = formData.get(key) === 'on';
        }

        try {
            if (id) {
                // Update
                await db.update(notificationChannels)
                    .set({
                        name,
                        enabled,
                        config,
                        events,
                        updatedAt: new Date()
                    })
                    .where(and(
                        eq(notificationChannels.id, id),
                        eq(notificationChannels.teamId, locals.team.id)
                    ));
            } else {
                // Create
                await db.insert(notificationChannels).values({
                    teamId: locals.team.id,
                    name,
                    type,
                    enabled,
                    config,
                    events
                });
            }

            return { success: true };
        } catch (err: any) {
            return fail(500, { message: 'Failed to save notification channel' });
        }
    },

    deleteChannel: async ({ request, locals }) => {
        await requireAuth(locals);
        if (!locals.team) {
            return fail(400, { message: 'Team required for this operation' });
        }
        const formData = await request.formData();
        const id = formData.get('id') as string;

        try {
            await db.delete(notificationChannels)
                .where(and(
                    eq(notificationChannels.id, id),
                    eq(notificationChannels.teamId, locals.team.id)
                ));
            return { success: true };
        } catch (err: any) {
            return fail(500, { message: 'Failed to delete notification channel' });
        }
    }
};
