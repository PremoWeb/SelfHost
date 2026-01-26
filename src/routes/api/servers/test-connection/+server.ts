import { json } from '@sveltejs/kit';
import { testConnection } from '$lib/server/services/ssh';
import { requireApiAuth } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireApiAuth(locals);
    
    // Safety check: only allow test if user is logged in
    if (!locals.user) {
        return json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

	const { 
        ip, 
        port, 
        user, 
        password, 
        privateKeyId,
        cloudflareTunnelHostname,
        cloudflareAccessTokenId
    } = await request.json();

    try {
        const result = await testConnection({
            ip,
            port: Number(port),
            user,
            password,
            privateKeyId,
            teamId: locals.team?.id,
            cloudflareTunnelHostname,
            cloudflareAccessTokenId
        });

        return json(result);
    } catch (error: any) {
        return json({ success: false, message: error.message || 'Connection test failed' });
    }
};
