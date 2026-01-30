/**
 * Frontend stub for (app)/servers.remote — calls Zig API where implemented.
 */
import { api } from '$lib/api/client';

const notImpl = (name: string) => ({ success: false as const, message: `Zig backend: ${name} not implemented yet` });

export async function getServerStatus({ serverId }: { serverId: string }) {
	try {
		const res = await api.get<{ data?: any }>(`/servers/${serverId}`);
		const data = (res.data as any)?.data ?? res.data;
		return { success: true as const, data };
	} catch (e: any) {
		return { success: false as const, message: e.response?.data?.message ?? e.message ?? 'Failed to get server status' };
	}
}

export const installAgentRemote = async (_: { serverId: string; callbackUrl: string }) => notImpl('installAgentRemote');
export const forceUpdateServiceRemote = async (_: { serverId: string }) => notImpl('forceUpdateServiceRemote');
export const deployAppRemote = async (_: { serverId: string; appName: string; domain: string }) => notImpl('deployAppRemote');
export const deleteAppRemote = async (_: { serverId: string; appName: string }) => notImpl('deleteAppRemote');
export const getAppDiagnosticsRemote = async (_: { serverId: string; appName: string }) => notImpl('getAppDiagnosticsRemote');
export const createTunnelRemote = async () => notImpl('createTunnelRemote');
