/**
 * Frontend stub for (app)/github.remote — Zig API does not implement GitHub App completion yet.
 */
const notImpl = (name: string) => ({ success: false as const, message: `Zig backend: ${name} not implemented yet` });

export const completeGitHubApp = async (_: { token: string }) => notImpl('completeGitHubApp');
