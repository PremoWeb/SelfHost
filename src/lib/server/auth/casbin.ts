import { newEnforcer, type Adapter, type Model, Helper, newModel } from 'casbin';
import { db } from '../db/client';
import { casbinRule } from '../db/schema';
import { eq } from 'drizzle-orm';

// Custom Drizzle Adapter for Casbin
class DrizzleAdapter implements Adapter {
	async loadPolicy(model: Model): Promise<void> {
		const lines = await db.select().from(casbinRule);
		for (const line of lines) {
			const rule = line.ptype + ', ' + [line.v0, line.v1, line.v2, line.v3, line.v4, line.v5].filter(n => n).join(', ');
			Helper.loadPolicyLine(rule, model);
		}
	}

	async savePolicy(model: Model): Promise<boolean> {
		await db.delete(casbinRule);
		const rules = [];
		const astMap = model.model.get('p') || new Map();
        for (const [ptype, ast] of astMap) {
            for (const rule of ast.policy) {
                rules.push(this.createRule(ptype, rule));
            }
        }
        const astMapG = model.model.get('g') || new Map();
        for (const [ptype, ast] of astMapG) {
            for (const rule of ast.policy) {
                rules.push(this.createRule(ptype, rule));
            }
        }
        
        if (rules.length > 0) {
            await db.insert(casbinRule).values(rules);
        }
		return true;
	}

	async addPolicy(sec: string, ptype: string, rule: string[]): Promise<void> {
		const line = this.createRule(ptype, rule);
		await db.insert(casbinRule).values(line);
	}

	async removePolicy(sec: string, ptype: string, rule: string[]): Promise<void> {
        // Implementation omitted for brevity
	}

	async removeFilteredPolicy(sec: string, ptype: string, fieldIndex: number, ...fieldValues: string[]): Promise<void> {
		// Implementation omitted for brevity
	}

    private createRule(ptype: string, rule: string[]) {
        return {
            ptype,
            v0: rule[0] || null,
            v1: rule[1] || null,
            v2: rule[2] || null,
            v3: rule[3] || null,
            v4: rule[4] || null,
            v5: rule[5] || null
        };
    }
}

// Model definition (RBAC with God mode and Company permissions)
const textModel = `
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, "god") || g(r.sub, "super_admin") || (g(r.sub, "company_owner") && r.obj == p.obj && r.act == p.act) || (g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act)
`;

// Singleton Enforcer
let enforcerInstance: any = null;

export async function getEnforcer() {
    if (!enforcerInstance) {
        const adapter = new DrizzleAdapter();
        // Use newModel directly
        enforcerInstance = await newEnforcer(newModel(textModel), adapter);
    }
    return enforcerInstance;
}

export async function reloadPolicy() {
    const e = await getEnforcer();
    await e.loadPolicy();
}
