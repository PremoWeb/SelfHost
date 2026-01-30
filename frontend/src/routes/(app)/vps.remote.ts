/**
 * Frontend stub for (app)/vps.remote — Zig API does not implement VPS plan endpoints yet.
 */
const notImpl = (name: string) => ({ success: false as const, message: `Zig backend: ${name} not implemented yet` });

export const getVpsPlans = async (_: { regionId: string; providerId: string }) => notImpl('getVpsPlans');
