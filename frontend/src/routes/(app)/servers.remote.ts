/**
 * Frontend stub for (app)/servers.remote — calls Zig API where implemented.
 */
import { api } from '$lib/api/client';

export type RemoteResponse<T = any> = 
	| { success: true; data: T; message?: string }
	| { success: false; message: string; data?: never };

const notImpl = (name: string): RemoteResponse => ({ success: false, message: `Zig backend: ${name} not implemented yet` });

export async function getServerStatus({ serverId }: { serverId: string }): Promise<RemoteResponse> {
	try {
		const res = await api.get<{ data?: any }>(`/servers/${serverId}`);
		const data = (res.data as any)?.data ?? res.data;
		return { success: true, data };
	} catch (e: any) {
		return { success: false, message: e.response?.data?.message ?? e.message ?? 'Failed to get server status' };
	}
}

export const installAgentRemote = async (_: { serverId: string; callbackUrl: string }): Promise<RemoteResponse> => notImpl('installAgentRemote');
export const forceUpdateServiceRemote = async (_: { serverId: string }): Promise<RemoteResponse> => notImpl('forceUpdateServiceRemote');
export const deployAppRemote = async (_: { serverId: string; appName: string; domain: string }): Promise<RemoteResponse> => notImpl('deployAppRemote');
export const deleteAppRemote = async (_: { serverId: string; appName: string }): Promise<RemoteResponse> => notImpl('deleteAppRemote');
export const getAppDiagnosticsRemote = async (_: { serverId: string; appName: string }): Promise<RemoteResponse> => notImpl('getAppDiagnosticsRemote');

export const createTunnelRemote = async (): Promise<{
	success: boolean;
	data?: { url: string };
	message?: string;
}> => {
	try {
		const res = await api.post<{ url: string | null }>('/dev/tunnel');
		const url = res.data?.url;
		if (url) return { success: true, data: { url } };
		return { success: false, message: 'Tunnel not available' };
	} catch (e: any) {
		const msg = e.response?.data?.message ?? e.message ?? 'Failed to create tunnel';
		return { success: false, message: msg };
	}
};
