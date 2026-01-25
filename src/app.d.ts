import type { User, Team, Session } from '$lib/server/db/schema';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: User | null;
			team: Team | null;
			sessionId: string | null;
			session: Session | null;
			impersonatedBy?: User | null;
			isImpersonating?: boolean;
			activeCompanyId?: string | null;
			impersonationType?: 'user' | 'team' | 'company';
			impersonationEntity?: any;
			forceTeamId?: string;
			forceCompanyId?: string;
		}
		// interface PageData {}
		interface PageState {
			onboardingStep?: 'ssh-key' | 'server' | 'source' | 'project';
		}
		// interface Platform {}
	}
}

export {};
