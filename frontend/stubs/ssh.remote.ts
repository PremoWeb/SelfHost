/**
 * Frontend stub for (app)/ssh.remote — Zig API does not implement SSH key endpoints yet.
 */
const notImpl = (name: string) => ({ success: false as const, message: `Zig backend: ${name} not implemented yet` });

export const addSshKeyRemote = async (_: any) => notImpl('addSshKeyRemote');
export const deleteSshKeyRemote = async (_: { keyId: string }) => notImpl('deleteSshKeyRemote');
