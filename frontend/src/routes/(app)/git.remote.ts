/**
 * Frontend stub for (app)/git.remote — Zig API does not implement git repo endpoints yet.
 */
const notImpl = (name: string) => ({ success: false as const, message: `Zig backend: ${name} not implemented yet` });

export const createRepositoryRemote = async (_: any) => notImpl('createRepositoryRemote');
export const updateRepositorySettingsRemote = async (_: any) => notImpl('updateRepositorySettingsRemote');
