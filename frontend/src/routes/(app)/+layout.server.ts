import type { LayoutServerLoad } from './$types';
export const load: LayoutServerLoad = async () => ({
	user: null,
	team: null,
	activeCompany: null,
	teams: [],
	companies: [],
	users: [],
	isSuperAdmin: false,
	isGod: false,
	isImpersonating: false,
	impersonatedBy: null,
	impersonationType: null,
	impersonationEntity: null,
	websiteMode: false
});
