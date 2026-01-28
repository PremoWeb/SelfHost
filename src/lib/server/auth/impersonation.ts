import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { teams, companies, users } from '../db/schema';
import { isGod } from './permissions';
import { getUserById, setSessionTeam, setSessionCompany } from './session';
import type { RequestEvent } from '@sveltejs/kit';

export interface ImpersonationResult {
	user?: any;
	impersonatedBy?: any;
	isImpersonating: boolean;
	impersonationType?: 'user' | 'team' | 'company';
	impersonationEntity?: any;
	forceTeamId?: string;
	forceCompanyId?: string;
}

/**
 * Handles all impersonation logic for a request
 */
export async function handleImpersonation(
	event: RequestEvent,
	session: any
): Promise<ImpersonationResult | null> {
	// 1. Check for Better Auth's built-in user impersonation
	const betterAuthImpersonatedBy = (session.session as any).impersonatedBy;

	// 2. Check for custom team/company impersonation cookies
	const impersonatedType = event.cookies.get('impersonated_type') as 'user' | 'team' | 'company' | null;
	const impersonatedId = event.cookies.get('impersonated_id');
	const impersonatedUserId = event.cookies.get('impersonated_user_id'); // Backward compatibility
	const impersonatedBy = event.cookies.get('impersonated_by');

	// Handle Better Auth's built-in user impersonation first
	if (betterAuthImpersonatedBy) {
		const originalUser = await getUserById(betterAuthImpersonatedBy);
		if (originalUser && (await isGod(originalUser.id))) {
			return {
				user: {
					...session.user,
					image: session.user.image ?? null,
					isGod: (session.user as any).isGod ?? false
				},
				impersonatedBy: originalUser,
				isImpersonating: true,
				impersonationType: 'user',
				impersonationEntity: session.user
			};
		}
	}

	// Handle custom team/company impersonation
	if ((impersonatedType && impersonatedId && impersonatedBy && impersonatedType !== 'user') || (impersonatedUserId && impersonatedBy)) {
		const originalUser = await getUserById(impersonatedBy!);
		if (originalUser && (await isGod(originalUser.id))) {
			
			// New format (type + id) for team/company
			if (impersonatedType && impersonatedId) {
				if (impersonatedType === 'team') {
					const [team] = await db.select().from(teams).where(eq(teams.id, impersonatedId)).limit(1);
					if (team) {
						await setSessionTeam(session.session.id, team.id);
						await setSessionCompany(session.session.id, null);
						return {
							user: { ...session.user, image: session.user.image ?? null, isGod: (session.user as any).isGod ?? false },
							impersonatedBy: originalUser,
							isImpersonating: true,
							impersonationType: 'team',
							impersonationEntity: team,
							forceTeamId: team.id
						};
					}
				} else if (impersonatedType === 'company') {
					const [company] = await db.select().from(companies).where(eq(companies.id, impersonatedId)).limit(1);
					if (company) {
						await setSessionCompany(session.session.id, company.id);
						await setSessionTeam(session.session.id, null);
						return {
							user: { ...session.user, image: session.user.image ?? null, isGod: (session.user as any).isGod ?? false },
							impersonatedBy: originalUser,
							isImpersonating: true,
							impersonationType: 'company',
							impersonationEntity: company,
							forceCompanyId: company.id
						};
					}
				}
			} 
			
			// Backward compatibility: old format (user impersonation)
			if (impersonatedUserId) {
				const impersonatedUser = await getUserById(impersonatedUserId);
				if (impersonatedUser) {
					return {
						user: {
							...impersonatedUser,
							image: impersonatedUser.image ?? null,
							isGod: impersonatedUser.isGod ?? false
						},
						impersonatedBy: originalUser,
						isImpersonating: true,
						impersonationType: 'user',
						impersonationEntity: impersonatedUser
					};
				}
			}
		}

		// If we reach here, impersonation was invalid
		clearImpersonationCookies(event);
	}

	return null;
}

export function clearImpersonationCookies(event: RequestEvent) {
	event.cookies.delete('impersonated_type', { path: '/' });
	event.cookies.delete('impersonated_id', { path: '/' });
	event.cookies.delete('impersonated_user_id', { path: '/' });
	event.cookies.delete('impersonated_by', { path: '/' });
}
