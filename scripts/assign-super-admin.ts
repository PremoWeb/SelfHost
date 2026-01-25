import 'dotenv/config';
import { db } from '../src/lib/server/db/client';
import { users } from '../src/lib/server/db/schema';
import { getEnforcer } from '../src/lib/server/auth/casbin';
import { eq } from 'drizzle-orm';

async function assignSuperAdmin() {
	try {
		// Get the first user
		const firstUser = await db.query.users.findFirst({
			orderBy: (users, { asc }) => [asc(users.createdAt)]
		});

		if (!firstUser) {
			console.error('No users found in database');
			process.exit(1);
		}

		console.log(`Found first user: ${firstUser.email} (${firstUser.id})`);

		// Get enforcer and assign super_admin role
		const enforcer = await getEnforcer();
		
		// Check if already has the role
		const roles = await enforcer.getRolesForUser(firstUser.id);
		if (roles.includes('super_admin')) {
			console.log('User already has super_admin role');
			process.exit(0);
		}

		// Add the role
		await enforcer.addGroupingPolicy(firstUser.id, 'super_admin');
		
		// Save the policy
		await enforcer.savePolicy();
		
		console.log(`Successfully assigned super_admin role to ${firstUser.email}`);
		process.exit(0);
	} catch (error) {
		console.error('Failed to assign super_admin role:', error);
		process.exit(1);
	}
}

assignSuperAdmin();
