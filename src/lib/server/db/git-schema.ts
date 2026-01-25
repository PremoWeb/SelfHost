import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';
import { projects, users, teams } from './schema';

/**
 * Git Repositories table
 * Links git repositories to projects
 */
export const gitRepositories = sqliteTable('git_repositories', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
	name: text('name').notNull(), // Repository name (slug)
	description: text('description'),
	isPrivate: integer('is_private', { mode: 'boolean' }).default(false).notNull(),
	
	// Repository path on filesystem (relative to data directory)
	repositoryPath: text('repository_path').notNull().unique(),
	
	// Default branch
	defaultBranch: text('default_branch').default('main').notNull(),
	
	// Statistics
	size: integer('size').default(0).notNull(), // Size in bytes
	commitCount: integer('commit_count').default(0).notNull(),
	branchCount: integer('branch_count').default(0).notNull(),
	tagCount: integer('tag_count').default(0).notNull(),
	
	// Last activity
	lastCommitAt: integer('last_commit_at', { mode: 'timestamp' }),
	lastCommitMessage: text('last_commit_message'),
	lastCommitAuthor: text('last_commit_author'),
	
	// Settings
	allowHttpPush: integer('allow_http_push', { mode: 'boolean' }).default(true).notNull(),
	allowSshPush: integer('allow_ssh_push', { mode: 'boolean' }).default(true).notNull(),
	isTemplate: integer('is_template', { mode: 'boolean' }).default(false).notNull(),
	isReadOnly: integer('is_read_only', { mode: 'boolean' }).default(false).notNull(),
	
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

/**
 * SSH Keys table
 * User SSH keys for git authentication
 */
export const sshKeys = sqliteTable('ssh_keys', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	
	// Key information
	title: text('title').notNull(), // User-friendly name
	publicKey: text('public_key').notNull(), // SSH public key
	keyType: text('key_type').notNull(), // ssh-rsa, ssh-ed25519, etc.
	fingerprint: text('fingerprint').notNull().unique(), // SHA256 fingerprint
	
	// Usage tracking
	lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
	
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

/**
 * Repository Collaborators table
 * Controls who can access which repositories
 */
export const repositoryCollaborators = sqliteTable('repository_collaborators', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	repositoryId: text('repository_id').notNull().references(() => gitRepositories.id, { onDelete: 'cascade' }),
	
	// Collaborator can be a user or team
	collaboratorType: text('collaborator_type').notNull(), // 'user' | 'team'
	collaboratorId: text('collaborator_id').notNull(), // user_id or team_id
	
	// Permissions
	canRead: integer('can_read', { mode: 'boolean' }).default(true).notNull(),
	canWrite: integer('can_write', { mode: 'boolean' }).default(false).notNull(),
	canAdmin: integer('can_admin', { mode: 'boolean' }).default(false).notNull(),
	
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Relations
export const gitRepositoriesRelations = relations(gitRepositories, ({ one, many }) => ({
	project: one(projects, {
		fields: [gitRepositories.projectId],
		references: [projects.id]
	}),
	collaborators: many(repositoryCollaborators)
}));

export const sshKeysRelations = relations(sshKeys, ({ one }) => ({
	user: one(users, {
		fields: [sshKeys.userId],
		references: [users.id]
	})
}));

export const repositoryCollaboratorsRelations = relations(repositoryCollaborators, ({ one }) => ({
	repository: one(gitRepositories, {
		fields: [repositoryCollaborators.repositoryId],
		references: [gitRepositories.id]
	})
}));
