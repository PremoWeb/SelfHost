/**
 * Frontend stub for (app)/servers/[id]/server.remote — calls Zig API where implemented.
 */
const notImpl = (name: string) => ({ success: false as const, message: `Zig backend: ${name} not implemented yet` });

export const diagnoseServer = async (_: { serverId: string }) => notImpl('diagnoseServer');
export const rebootServer = async (_: { serverId: string; type?: 'graceful' | 'hard' | 'intelligent' }) => notImpl('rebootServer');
export const restartAgent = async (_: { serverId: string }) => notImpl('restartAgent');
export const forceUpdateService = async (_: { serverId: string }) => notImpl('forceUpdateService');
export const getAppStatus = async (_: { serverId: string; appName: string }) => notImpl('getAppStatus');
export const proxyAction = async (_: any) => notImpl('proxyAction');
export const checkReadiness = async (_: { serverId: string }) => notImpl('checkReadiness');
export const installPrivateKeyRemote = async (_: any) => notImpl('installPrivateKeyRemote');
export const updateVpsApiKeyRemote = async (_: any) => notImpl('updateVpsApiKeyRemote');
