import 'dotenv/config';
import { db } from '../src/lib/server/db/client';
import { users, casbinRule } from '../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getEnforcer } from '../src/lib/server/auth/casbin';

async function assignGodRole() {
	try {
		// Get the first user
		const firstUser = await db.query.users.findFirst({
			orderBy: (users, { asc }) => [asc(users.createdAt)]
		});

		if (!firstUser) {
			console.error('No users found in database');
			process.exit(1);
		}

		console.log(`Assigning god role to user: ${firstUser.email} (${firstUser.id})`);

		// Set isGod flag
		await db.update(users).set({ isGod: true }).where(eq(users.id, firstUser.id));
		console.log('✓ Set is_god = true in database');

		// Assign god role in Casbin
		const enforcer = await getEnforcer();
		
		// Check if already has god role
		const hasGodRole = await enforcer.hasRoleForUser(firstUser.id, 'god');
		if (!hasGodRole) {
			await enforcer.addGroupingPolicy(firstUser.id, 'god');
			console.log('✓ Added god role to Casbin');
		} else {
			console.log('✓ User already has god role in Casbin');
		}

		// Also assign super_admin role
		const hasSuperAdminRole = await enforcer.hasRoleForUser(firstUser.id, 'super_admin');
		if (!hasSuperAdminRole) {
			await enforcer.addGroupingPolicy(firstUser.id, 'super_admin');
			console.log('✓ Added super_admin role to Casbin');
		} else {
			console.log('✓ User already has super_admin role in Casbin');
		}

		// Save policy
		await enforcer.savePolicy();
		console.log('✓ Saved Casbin policy');

		// Verify
		const finalUser = await db.query.users.findFirst({
			where: eq(users.id, firstUser.id),
			columns: { id: true, email: true, isGod: true }
		});
		console.log('\nFinal user state:', finalUser);

		const finalRoles = await enforcer.getRolesForUser(firstUser.id);
		console.log('Final Casbin roles:', finalRoles);

		console.log('\n✓ God role assignment complete!');
		process.exit(0);
	} catch (error) {
		console.error('Failed to assign god role:', error);
		process.exit(1);
	}
}

assignGodRole();
