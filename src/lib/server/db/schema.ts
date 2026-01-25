import { sqliteTable, text, integer, foreignKey } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// Instance Settings (Singleton)
export const instanceSettings = sqliteTable('instance_settings', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	fqdn: text('fqdn'),
	registrationEnabled: integer('registration_enabled', { mode: 'boolean' }).default(true).notNull(),
	doNotTrack: integer('do_not_track', { mode: 'boolean' }).default(false).notNull(),
	isCloudSetup: integer('is_cloud_setup', { mode: 'boolean' }).default(false).notNull(),
	instanceId: text('instance_id').unique(),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Users table (Better Auth compatible)
export const users = sqliteTable('users', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	isGod: integer('is_god', { mode: 'boolean' }).default(false).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Accounts table (Better Auth)
export const accounts = sqliteTable('account', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Verifications table (Better Auth)
export const verifications = sqliteTable('verification', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Casbin Rules table
export const casbinRule = sqliteTable('casbin_rule', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	ptype: text('ptype').notNull(),
	v0: text('v0'),
	v1: text('v1'),
	v2: text('v2'),
	v3: text('v3'),
	v4: text('v4'),
	v5: text('v5')
});

// Companies table
export const companies = sqliteTable('companies', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	slug: text('slug').notNull().unique(),
	createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
	billingProfileId: text('billing_profile_id'),
	settings: text('settings', { mode: 'json' }).default({}).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Company Members table
export const companyMembers = sqliteTable('company_members', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	role: text('role').notNull().default('member'), // owner, admin, member
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Project Categories table
export const projectCategories = sqliteTable('project_categories', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	slug: text('slug').notNull(),
	description: text('description'),
	parentId: text('parent_id'),
	tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
	metadata: text('metadata', { mode: 'json' }).default({}),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
}, (table) => ({
	parentReference: foreignKey({
		columns: [table.parentId],
		foreignColumns: [table.id]
	}).onDelete('set null')
}));

// Project Assignments table
export const projectAssignments = sqliteTable('project_assignments', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
	assigneeType: text('assignee_type').notNull(), // individual, team, company
	assigneeId: text('assignee_id').notNull(), // user_id, team_id, or company_id
	role: text('role').notNull().default('viewer'), // owner, admin, editor, viewer
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Company Resource Shares table
export const companyResourceShares = sqliteTable('company_resource_shares', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	resourceType: text('resource_type').notNull(), // server, domain, vps_provider, etc.
	resourceId: text('resource_id').notNull(),
	ownerCompanyId: text('owner_company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
	sharedWithCompanyId: text('shared_with_company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
	permissions: text('permissions', { mode: 'json' }).default({}).notNull(), // { read, manage, create_with_approval }
	approvedBy: text('approved_by').references(() => users.id, { onDelete: 'set null' }),
	approvedAt: integer('approved_at', { mode: 'timestamp' }),
	status: text('status').default('pending').notNull(), // pending, approved, rejected
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Billing Profiles table
export const billingProfiles = sqliteTable('billing_profiles', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
	billingEmail: text('billing_email'),
	billingAddress: text('billing_address', { mode: 'json' }).default({}),
	paymentMethod: text('payment_method', { mode: 'json' }).default({}),
	settings: text('settings', { mode: 'json' }).default({}),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Project Category Collaborations table
export const projectCategoryCollaborations = sqliteTable('project_category_collaborations', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	categoryId: text('category_id').notNull().references(() => projectCategories.id, { onDelete: 'cascade' }),
	companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
	canCreateProjects: integer('can_create_projects', { mode: 'boolean' }).default(false).notNull(),
	canViewProjects: integer('can_view_projects', { mode: 'boolean' }).default(false).notNull(),
	canManageProjects: integer('can_manage_projects', { mode: 'boolean' }).default(false).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Teams table
export const teams = sqliteTable('teams', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	personalTeam: integer('personal_team', { mode: 'boolean' }).default(false).notNull(),
	companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
	defaultNameserverProfileId: text('default_nameserver_profile_id'),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Team members (many-to-many)
export const teamMembers = sqliteTable('team_members', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	role: text('role').notNull().default('member'), // owner, admin, member
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Clients table (CRM)
export const clients = sqliteTable('clients', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	email: text('email'),
	phone: text('phone'),
	company: text('company'),
	teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }), // Kept for backward compatibility
	companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Projects table
export const projects = sqliteTable('projects', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }), // Kept for backward compatibility
	clientId: text('client_id').references(() => clients.id, { onDelete: 'set null' }),
	categoryId: text('category_id').references(() => projectCategories.id, { onDelete: 'set null' }),
	billingProfileId: text('billing_profile_id').references(() => billingProfiles.id, { onDelete: 'set null' }),
	companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Environments table
export const environments = sqliteTable('environments', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Private Keys table
export const privateKeys = sqliteTable('private_keys', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	privateKey: text('private_key').notNull(),
	teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }), // Kept for backward compatibility
	ownerType: text('owner_type'), // company, individual, team
	ownerId: text('owner_id'), // company_id, user_id, or team_id
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// API Tokens table
export const apiTokens = sqliteTable('api_tokens', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	token: text('token').notNull().unique(),
	teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }), // Kept for backward compatibility
	ownerType: text('owner_type'), // company, individual, team
	ownerId: text('owner_id'), // company_id, user_id, or team_id
	lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// VPS Providers table
export const vpsProviders = sqliteTable('vps_providers', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	type: text('type').notNull(), // vultr
	apiKey: text('api_key').notNull(),
    dnsEnabled: integer('dns_enabled', { mode: 'boolean' }).default(false).notNull(),
	teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }), // Kept for backward compatibility
	ownerType: text('owner_type'), // company, individual
	ownerId: text('owner_id'), // company_id or user_id
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Cloudflare Access Tokens table
export const cloudflareAccessTokens = sqliteTable('cloudflare_access_tokens', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	clientId: text('client_id').notNull(),
	clientSecret: text('client_secret').notNull(),
	teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }), // Kept for backward compatibility
	ownerType: text('owner_type'), // company, individual, team
	ownerId: text('owner_id'), // company_id, user_id, or team_id
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Domains table
export const domains = sqliteTable('domains', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	provider: text('provider').notNull().default('custom'), // vultr, cloudflare, custom
	teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }), // Kept for backward compatibility
	ownerType: text('owner_type'), // company, individual, team
	ownerId: text('owner_id'), // company_id, user_id, or team_id
	nameserverProfileId: text('nameserver_profile_id').references(() => nameserverProfiles.id, { onDelete: 'set null' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Servers table
export const servers = sqliteTable('servers', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	region: text('region'),
	ip: text('ip').notNull(),
	ipv6: text('ipv6'),
	port: integer('port').default(22).notNull(),
	user: text('user').default('root').notNull(),
	status: text('status').default('offline').notNull(), // online, offline, unreachable
	tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
	teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }), // Kept for backward compatibility
	ownerType: text('owner_type'), // company, individual, team
	ownerId: text('owner_id'), // company_id, user_id, or team_id
	privateKeyId: text('private_key_id').references(() => privateKeys.id, { onDelete: 'set null' }),
	connectionType: text('connection_type').default('ssh').notNull(), // ssh, agent
	agentKey: text('agent_key'),
	agentChecksum: text('agent_checksum'),
	agentVersion: text('agent_version'),
	agentInstalledAt: integer('agent_installed_at', { mode: 'timestamp' }),
	vpsProviderId: text('vps_provider_id').references(() => vpsProviders.id, { onDelete: 'set null' }),
	// Cloudflare Tunnel Support
	cloudflareTunnelHostname: text('cloudflare_tunnel_hostname'),
	cloudflareAccessTokenId: text('cloudflare_access_token_id').references(() => cloudflareAccessTokens.id, { onDelete: 'set null' }),
	healthCpu: integer('health_cpu').default(0),
	healthMemory: integer('health_memory').default(0),
	healthDisk: integer('health_disk').default(0),
	healthUpdatedAt: integer('health_updated_at', { mode: 'timestamp' }),
	proxyType: text('proxy_type').default('none').notNull(), // none, traefik, caddy
	proxyStatus: text('proxy_status').default('stopped').notNull(), // running, stopped, starting, error
	proxyLastAppliedAt: integer('proxy_last_applied_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Destinations table
export const destinations = sqliteTable('destinations', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	type: text('type').notNull(), // docker, swarm, kubernetes
	network: text('network').default('selfhost').notNull(),
	serverId: text('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
	teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }), // Kept for backward compatibility
	ownerType: text('owner_type'), // company, individual, team
	ownerId: text('owner_id'), // company_id, user_id, or team_id
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Sources table (Git providers)
export const sources = sqliteTable('sources', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	type: text('type').notNull(), // github, gitlab, bitbucket, custom
	apiUrl: text('api_url'),
	htmlUrl: text('html_url'),
	token: text('token'), // For PAT authentication
	// GitHub App fields
	isApp: integer('is_app', { mode: 'boolean' }).default(false).notNull(),
	appId: text('app_id'), // GitHub App ID
	installationId: text('installation_id'), // GitHub App Installation ID
	clientId: text('client_id'), // OAuth client ID
	clientSecret: text('client_secret'), // OAuth client secret
	privateKey: text('private_key'), // PEM-encoded private key for JWT signing
	webhookSecret: text('webhook_secret'), // Secret for validating webhooks
	teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }), // Kept for backward compatibility
	ownerType: text('owner_type'), // company, individual, team
	ownerId: text('owner_id'), // company_id, user_id, or team_id
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// S3 Storages table
export const s3Storages = sqliteTable('s3_storages', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	endpoint: text('endpoint').notNull(),
	region: text('region').notNull(),
	bucket: text('bucket').notNull(),
	accessKey: text('access_key').notNull(),
	secretKey: text('secret_key').notNull(),
	teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }), // Kept for backward compatibility
	ownerType: text('owner_type'), // company, individual, team
	ownerId: text('owner_id'), // company_id, user_id, or team_id
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Shared Variables table
export const sharedVariables = sqliteTable('shared_variables', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	key: text('key').notNull(),
	value: text('value').notNull(),
	isPublic: integer('is_public', { mode: 'boolean' }).default(false).notNull(),
	teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }), // Kept for backward compatibility
	ownerType: text('owner_type'), // company, individual, team
	ownerId: text('owner_id'), // company_id, user_id, or team_id
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Environment Variables table
export const environmentVariables = sqliteTable('environment_variables', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	key: text('key').notNull(),
	value: text('value').notNull(),
	isBuildTime: integer('is_build_time', { mode: 'boolean' }).default(false).notNull(),
	isPreview: integer('is_preview', { mode: 'boolean' }).default(false).notNull(),
	applicationId: text('application_id').references(() => applications.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Applications table
export const applications = sqliteTable('applications', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	fqdn: text('fqdn'),
	status: text('status').default('stopped').notNull(), // running, stopped, restarting, exited, degraded
	gitRepository: text('git_repository'),
	gitBranch: text('git_branch').default('main'),
	buildPack: text('build_pack'),
	environmentId: text('environment_id').notNull().references(() => environments.id, { onDelete: 'cascade' }),
	destinationId: text('destination_id').references(() => destinations.id, { onDelete: 'set null' }),
	sourceId: text('source_id').references(() => sources.id, { onDelete: 'set null' }),
	s3StorageId: text('s3_storage_id').references(() => s3Storages.id, { onDelete: 'set null' }),
	settings: text('settings', { mode: 'json' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Databases table
export const databases = sqliteTable('databases', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	type: text('type').notNull(), // postgresql, mysql, mariadb, mongodb
	status: text('status').default('stopped').notNull(),
	environmentId: text('environment_id').notNull().references(() => environments.id, { onDelete: 'cascade' }),
	destinationId: text('destination_id').references(() => destinations.id, { onDelete: 'set null' }),
	s3StorageId: text('s3_storage_id').references(() => s3Storages.id, { onDelete: 'set null' }),
	settings: text('settings', { mode: 'json' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Deployments table
export const deployments = sqliteTable('deployments', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	status: text('status').default('queued').notNull(), // queued, in_progress, finished, failed, cancelled
	commit: text('commit'),
	commitMessage: text('commit_message'),
	applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
	startedAt: integer('started_at', { mode: 'timestamp' }),
	finishedAt: integer('finished_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Sessions table (Better Auth compatible)
export const sessions = sqliteTable('session', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	token: text('token').notNull().unique(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	// Better Auth Admin plugin field for impersonation
	impersonatedBy: text('impersonated_by').references(() => users.id, { onDelete: 'set null' }),
    // Custom field for Team Context (kept from previous, but integrated)
	activeTeamId: text('active_team_id').references(() => teams.id, { onDelete: 'set null' }),
	// Custom field for Company Context
	activeCompanyId: text('active_company_id').references(() => companies.id, { onDelete: 'set null' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// VPS Templates table
export const vpsTemplates = sqliteTable('vps_templates', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	region: text('region').notNull(),
	plan: text('plan').notNull(),
	osId: integer('os_id').notNull(),
	sshKeyIds: text('ssh_key_ids').$type<string[]>(), // Array of SSH key IDs to install
	vpsProviderId: text('vps_provider_id').notNull().references(() => vpsProviders.id, { onDelete: 'cascade' }),
	teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Nameserver Profiles table
export const nameserverProfiles = sqliteTable('nameserver_profiles', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	ns1: text('ns1').notNull(),
	ns2: text('ns2'),
	ns3: text('ns3'),
	ns4: text('ns4'),
	teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
	dnsProviderId: text('dns_provider_id').references(() => vpsProviders.id, { onDelete: 'set null' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Nameserver Profile Shares
export const nameserverProfileShares = sqliteTable('nameserver_profile_shares', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	profileId: text('profile_id').notNull().references(() => nameserverProfiles.id, { onDelete: 'cascade' }),
	assigneeType: text('assignee_type').notNull(), // user, team, company
	assigneeId: text('assignee_id').notNull(),
	role: text('role').default('use').notNull(), // use, manage
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});


// DNS Records table
export const dnsRecords = sqliteTable('dns_records', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
	type: text('type').notNull(), // A, AAAA, CNAME, MX, TXT, NS, SRV, etc.
	name: text('name').notNull(), // subdomain or @ for root
	value: text('value'), // static value (for non-synced records)
	ttl: integer('ttl').default(3600).notNull(),
	priority: integer('priority'), // for MX, SRV records
	// Tag-based sync configuration
	syncMode: text('sync_mode').default('static').notNull(), // static, server, tag
	serverId: text('server_id').references(() => servers.id, { onDelete: 'cascade' }), // for syncMode='server'
	syncTag: text('sync_tag'), // for syncMode='tag'
	teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Relations
// Notification Channels (Unified)
export const notificationChannels = sqliteTable('notification_channels', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	type: text('type').notNull(), // email, discord, telegram
	enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
	
	// Configuration (specific to type)
    // Email: { provider: 'smtp'|'resend'|'sendgrid', smtp: {}, resend: {}, sendgrid: {}, recipients: string }
    // Discord: { webhookUrl: string }
    // Telegram: { botToken: string, chatId: string }
	config: text('config', { mode: 'json' }).default({}).notNull(),

	// Triggers
    // { deploymentSuccess: boolean, ... }
	events: text('events', { mode: 'json' }).default({}).notNull(),

	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Shared Projects (Team access to projects)
export const sharedProjects = sqliteTable('shared_projects', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
	teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
	role: text('role').notNull().default('viewer'), // viewer, editor, admin
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Relations

export const notificationChannelsRelations = relations(notificationChannels, ({ one }) => ({
	team: one(teams, {
		fields: [notificationChannels.teamId],
		references: [teams.id]
	})
}));

export const usersRelations = relations(users, ({ many, one }) => ({
	teamMembers: many(teamMembers),
	companyMembers: many(companyMembers),
	createdCompanies: many(companies, { relationName: 'createdBy' })
}));

export const companiesRelations = relations(companies, ({ many, one }) => ({
	createdBy: one(users, {
		fields: [companies.createdBy],
		references: [users.id],
		relationName: 'createdBy'
	}),
	members: many(companyMembers),
	teams: many(teams),
	projects: many(projects),
	clients: many(clients),
	billingProfile: one(billingProfiles, {
		fields: [companies.billingProfileId],
		references: [billingProfiles.id]
	}),
	resourceSharesOwned: many(companyResourceShares, { relationName: 'owner' }),
	resourceSharesShared: many(companyResourceShares, { relationName: 'sharedWith' }),
	categoryCollaborations: many(projectCategoryCollaborations)
}));

export const companyMembersRelations = relations(companyMembers, ({ one }) => ({
	company: one(companies, {
		fields: [companyMembers.companyId],
		references: [companies.id]
	}),
	user: one(users, {
		fields: [companyMembers.userId],
		references: [users.id]
	})
}));

export const projectCategoriesRelations = relations(projectCategories, ({ one, many }) => ({
	parent: one(projectCategories, {
		fields: [projectCategories.parentId],
		references: [projectCategories.id],
		relationName: 'parent'
	}),
	children: many(projectCategories, { relationName: 'parent' }),
	projects: many(projects),
	collaborations: many(projectCategoryCollaborations)
}));

export const projectAssignmentsRelations = relations(projectAssignments, ({ one }) => ({
	project: one(projects, {
		fields: [projectAssignments.projectId],
		references: [projects.id]
	})
}));

export const companyResourceSharesRelations = relations(companyResourceShares, ({ one }) => ({
	ownerCompany: one(companies, {
		fields: [companyResourceShares.ownerCompanyId],
		references: [companies.id],
		relationName: 'owner'
	}),
	sharedWithCompany: one(companies, {
		fields: [companyResourceShares.sharedWithCompanyId],
		references: [companies.id],
		relationName: 'sharedWith'
	}),
	approvedByUser: one(users, {
		fields: [companyResourceShares.approvedBy],
		references: [users.id]
	})
}));

export const billingProfilesRelations = relations(billingProfiles, ({ one, many }) => ({
	company: one(companies, {
		fields: [billingProfiles.companyId],
		references: [companies.id]
	}),
	projects: many(projects)
}));

export const projectCategoryCollaborationsRelations = relations(projectCategoryCollaborations, ({ one }) => ({
	category: one(projectCategories, {
		fields: [projectCategoryCollaborations.categoryId],
		references: [projectCategories.id]
	}),
	company: one(companies, {
		fields: [projectCategoryCollaborations.companyId],
		references: [companies.id]
	})
}));

export const teamsRelations = relations(teams, ({ many, one }) => ({
	members: many(teamMembers),
	projects: many(projects),
    sharedProjects: many(sharedProjects),
	servers: many(servers),
	privateKeys: many(privateKeys),
	apiTokens: many(apiTokens),
	destinations: many(destinations),
	sources: many(sources),
	s3Storages: many(s3Storages),
	sharedVariables: many(sharedVariables),
	vpsProviders: many(vpsProviders),
	cloudflareAccessTokens: many(cloudflareAccessTokens),
	domains: many(domains),
	vpsTemplates: many(vpsTemplates),
	nameserverProfiles: many(nameserverProfiles),
    defaultNameserverProfile: one(nameserverProfiles, {
		fields: [teams.defaultNameserverProfileId],
		references: [nameserverProfiles.id]
	}),
    notificationChannels: many(notificationChannels),
    clients: many(clients),
	company: one(companies, {
		fields: [teams.companyId],
		references: [companies.id]
	})
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
	team: one(teams, {
		fields: [clients.teamId],
		references: [teams.id]
	}),
	company: one(companies, {
		fields: [clients.companyId],
		references: [companies.id]
	}),
	projects: many(projects)
}));

export const sharedProjectsRelations = relations(sharedProjects, ({ one }) => ({
	project: one(projects, {
		fields: [sharedProjects.projectId],
		references: [projects.id]
	}),
	team: one(teams, {
		fields: [sharedProjects.teamId],
		references: [teams.id]
	})
}));


export const vpsProvidersRelations = relations(vpsProviders, ({ one, many }) => ({
	team: one(teams, {
		fields: [vpsProviders.teamId],
		references: [teams.id]
	}),
	servers: many(servers),
	vpsTemplates: many(vpsTemplates)
}));

export const domainsRelations = relations(domains, ({ one, many }) => ({
	team: one(teams, {
		fields: [domains.teamId],
		references: [teams.id]
	}),
	nameserverProfile: one(nameserverProfiles, {
		fields: [domains.nameserverProfileId],
		references: [nameserverProfiles.id]
	}),
	dnsRecords: many(dnsRecords)
}));

export const vpsTemplatesRelations = relations(vpsTemplates, ({ one }) => ({
	team: one(teams, {
		fields: [vpsTemplates.teamId],
		references: [teams.id]
	}),
	vpsProvider: one(vpsProviders, {
		fields: [vpsTemplates.vpsProviderId],
		references: [vpsProviders.id]
	})
}));

export const privateKeysRelations = relations(privateKeys, ({ one, many }) => ({
	team: one(teams, {
		fields: [privateKeys.teamId],
		references: [teams.id]
	}),
	servers: many(servers)
}));

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
	team: one(teams, {
		fields: [apiTokens.teamId],
		references: [teams.id]
	})
}));

export const serversRelations = relations(servers, ({ one, many }) => ({
	team: one(teams, {
		fields: [servers.teamId],
		references: [teams.id]
	}),
	privateKey: one(privateKeys, {
		fields: [servers.privateKeyId],
		references: [privateKeys.id]
	}),
	vpsProvider: one(vpsProviders, {
		fields: [servers.vpsProviderId],
		references: [vpsProviders.id]
	}),
	destinations: many(destinations)
}));

export const destinationsRelations = relations(destinations, ({ one, many }) => ({
	server: one(servers, {
		fields: [destinations.serverId],
		references: [servers.id]
	}),
	team: one(teams, {
		fields: [destinations.teamId],
		references: [teams.id]
	}),
	applications: many(applications),
	databases: many(databases)
}));

export const sourcesRelations = relations(sources, ({ one, many }) => ({
	team: one(teams, {
		fields: [sources.teamId],
		references: [teams.id]
	}),
	applications: many(applications)
}));

export const s3StoragesRelations = relations(s3Storages, ({ one, many }) => ({
	team: one(teams, {
		fields: [s3Storages.teamId],
		references: [teams.id]
	}),
	applications: many(applications),
	databases: many(databases)
}));

export const sharedVariablesRelations = relations(sharedVariables, ({ one }) => ({
	team: one(teams, {
		fields: [sharedVariables.teamId],
		references: [teams.id]
	})
}));

export const environmentVariablesRelations = relations(environmentVariables, ({ one }) => ({
	application: one(applications, {
		fields: [environmentVariables.applicationId],
		references: [applications.id]
	})
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
	team: one(teams, {
		fields: [teamMembers.teamId],
		references: [teams.id]
	}),
	user: one(users, {
		fields: [teamMembers.userId],
		references: [users.id]
	})
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
	team: one(teams, {
		fields: [projects.teamId],
		references: [teams.id]
	}),
	client: one(clients, {
		fields: [projects.clientId],
		references: [clients.id]
	}),
	category: one(projectCategories, {
		fields: [projects.categoryId],
		references: [projectCategories.id]
	}),
	billingProfile: one(billingProfiles, {
		fields: [projects.billingProfileId],
		references: [billingProfiles.id]
	}),
	company: one(companies, {
		fields: [projects.companyId],
		references: [companies.id]
	}),
	environments: many(environments),
    sharedProjects: many(sharedProjects),
	assignments: many(projectAssignments)
}));

export const environmentsRelations = relations(environments, ({ one, many }) => ({
	project: one(projects, {
		fields: [environments.projectId],
		references: [projects.id]
	}),
	applications: many(applications),
	databases: many(databases)
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
	environment: one(environments, {
		fields: [applications.environmentId],
		references: [environments.id]
	}),
	deployments: many(deployments),
	environmentVariables: many(environmentVariables)
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
	application: one(applications, {
		fields: [deployments.applicationId],
		references: [applications.id]
	})
}));

export const nameserverProfilesRelations = relations(nameserverProfiles, ({ one, many }) => ({
	team: one(teams, {
		fields: [nameserverProfiles.teamId],
		references: [teams.id]
	}),
	dnsProvider: one(vpsProviders, {
		fields: [nameserverProfiles.dnsProviderId],
		references: [vpsProviders.id]
	}),
	shares: many(nameserverProfileShares)
}));

export const nameserverProfileSharesRelations = relations(nameserverProfileShares, ({ one }) => ({
	profile: one(nameserverProfiles, {
		fields: [nameserverProfileShares.profileId],
		references: [nameserverProfiles.id]
	})
}));

export const dnsRecordsRelations = relations(dnsRecords, ({ one }) => ({
	domain: one(domains, {
		fields: [dnsRecords.domainId],
		references: [domains.id]
	}),
	server: one(servers, {
		fields: [dnsRecords.serverId],
		references: [servers.id]
	}),
	team: one(teams, {
		fields: [dnsRecords.teamId],
		references: [teams.id]
	})
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Server = typeof servers.$inferSelect;
export type NewServer = typeof servers.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type Database = typeof databases.$inferSelect;
export type NewDatabase = typeof databases.$inferInsert;
export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
export type PrivateKey = typeof privateKeys.$inferSelect;
export type NewPrivateKey = typeof privateKeys.$inferInsert;
export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
export type Destination = typeof destinations.$inferSelect;
export type NewDestination = typeof destinations.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type S3Storage = typeof s3Storages.$inferSelect;
export type NewS3Storage = typeof s3Storages.$inferInsert;
export type SharedVariable = typeof sharedVariables.$inferSelect;
export type NewSharedVariable = typeof sharedVariables.$inferInsert;
export type EnvironmentVariable = typeof environmentVariables.$inferSelect;
export type NewEnvironmentVariable = typeof environmentVariables.$inferInsert;
export type InstanceSettings = typeof instanceSettings.$inferSelect;
export type NewInstanceSettings = typeof instanceSettings.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type VpsProvider = typeof vpsProviders.$inferSelect;
export type NewVpsProvider = typeof vpsProviders.$inferInsert;
export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type VpsTemplate = typeof vpsTemplates.$inferSelect;
export type NewVpsTemplate = typeof vpsTemplates.$inferInsert;
export type NameserverProfile = typeof nameserverProfiles.$inferSelect;
export type NewNameserverProfile = typeof nameserverProfiles.$inferInsert;
export type DnsRecord = typeof dnsRecords.$inferSelect;
export type NewDnsRecord = typeof dnsRecords.$inferInsert;
export type CloudflareAccessToken = typeof cloudflareAccessTokens.$inferSelect;
export type NewCloudflareAccessToken = typeof cloudflareAccessTokens.$inferInsert;

export type NotificationChannel = typeof notificationChannels.$inferSelect;
export type NewNotificationChannel = typeof notificationChannels.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;
export type CasbinRule = typeof casbinRule.$inferSelect;
export type NewCasbinRule = typeof casbinRule.$inferInsert;

export type SharedProject = typeof sharedProjects.$inferSelect;
export type NewSharedProject = typeof sharedProjects.$inferInsert;

// Quick Deploy Apps table - tracks simple apps deployed via Quick Deploy feature
export const quickDeployApps = sqliteTable('quick_deploy_apps', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(), // App name (e.g., 'hello-world')
	domain: text('domain').notNull(), // Full domain (e.g., 'app.example.com')
	port: integer('port').notNull(), // Port the app runs on
	status: text('status').notNull().default('running'), // running, stopped, error
	serverId: text('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
	teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
	deployedAt: integer('deployed_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	lastCheckedAt: integer('last_checked_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

export type QuickDeployApp = typeof quickDeployApps.$inferSelect;
export type NewQuickDeployApp = typeof quickDeployApps.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type CompanyMember = typeof companyMembers.$inferSelect;
export type NewCompanyMember = typeof companyMembers.$inferInsert;
export type ProjectCategory = typeof projectCategories.$inferSelect;
export type NewProjectCategory = typeof projectCategories.$inferInsert;
export type ProjectAssignment = typeof projectAssignments.$inferSelect;
export type NewProjectAssignment = typeof projectAssignments.$inferInsert;
export type CompanyResourceShare = typeof companyResourceShares.$inferSelect;
export type NewCompanyResourceShare = typeof companyResourceShares.$inferInsert;
export type BillingProfile = typeof billingProfiles.$inferSelect;
export type NewBillingProfile = typeof billingProfiles.$inferInsert;
export type ProjectCategoryCollaboration = typeof projectCategoryCollaborations.$inferSelect;
export type NewProjectCategoryCollaboration = typeof projectCategoryCollaborations.$inferInsert;

// Export git schema types
export * from './git-schema';
