import { json } from '@sveltejs/kit';
import { generateKeyPair } from '$lib/server/services/security';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	await requireApiAuth(locals);
	await requireTeam(locals);

	try {
        // We generally only need the private key for the form, the public key is derived or stored if needed,
        // but typically SelfHost stores the private key and derives public key on demand or stores both.
        // The current schema 'privateKeys' table only has 'privateKey' column (text).
		const { privateKey, publicKey } = generateKeyPair();

		return json({
			data: {
				privateKey,
                publicKey // Sending it just in case, though might not be used immediately
			}
		});
	} catch (error: any) {
		return json({ message: error.message || 'Failed to generate key pair' }, { status: 500 });
	}
};
