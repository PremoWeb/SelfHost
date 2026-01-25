import { json } from '@sveltejs/kit';
import { startTunnel, getTunnelUrl } from '$lib/server/services/tunnel';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    if (!dev) return json({ message: 'Disabled' }, { status: 403 });
    const url = await getTunnelUrl();
    return json({ url });
};

export const POST: RequestHandler = async () => {
    if (!dev) return json({ message: 'Disabled' }, { status: 403 });
    try {
        const url = await startTunnel();
        return json({ url });
    } catch (err: any) {
        return json({ message: err.message }, { status: 500 });
    }
};
