/**
 * Frontend stub for (app)/servers/[id]/server.remote — calls Zig API where implemented.
 */
const notImpl = (name: string) => ({ success: false as const, message: `Zig backend: ${name} not implemented yet` });

export type RemoteResponse<T = any> = 
    | { success: true; data: T; message?: string; output?: string; status?: string; ready?: boolean; checks?: any[] }
    | { success: false; message: string; data?: never; output?: string; status?: string; ready?: boolean; checks?: any[] };


export const diagnoseServer = async (_: { serverId: string }): Promise<RemoteResponse> => notImpl('diagnoseServer');
export const rebootServer = async (_: { serverId: string; type?: 'graceful' | 'hard' | 'intelligent' }): Promise<RemoteResponse> => notImpl('rebootServer');
export const restartAgent = async (_: { serverId: string }): Promise<RemoteResponse> => notImpl('restartAgent');
export const forceUpdateService = async (_: { serverId: string; tunnelUrl?: string }): Promise<RemoteResponse> => notImpl('forceUpdateService');
export const getAppStatus = async (_: { serverId: string; appName: string }): Promise<RemoteResponse> => notImpl('getAppStatus');
export const proxyAction = async (_: any): Promise<RemoteResponse> => notImpl('proxyAction');
export const checkReadiness = async (_: { serverId: string }): Promise<RemoteResponse> => notImpl('checkReadiness');
export const installPrivateKeyRemote = async (_: { serverId: string; password?: string }): Promise<RemoteResponse<{ privateKeyId: string }>> => notImpl('installPrivateKeyRemote');
export const updateVpsApiKeyRemote = async (_: { providerId: string; apiKey: string }): Promise<RemoteResponse> => notImpl('updateVpsApiKeyRemote');

