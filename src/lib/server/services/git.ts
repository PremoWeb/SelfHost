import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, access, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { db } from '../db/client';
import { gitRepositories, sshKeys, repositoryCollaborators } from '../db/git-schema';
import { eq, and, or } from 'drizzle-orm';
import { createHash } from 'node:crypto';

import { env } from '$env/dynamic/private';

const execAsync = promisify(exec);

// Base directory for storing git repositories
const GIT_REPOS_ROOT = env.GIT_REPOS_ROOT || join(process.cwd(), 'data', 'git-repos');

// Ensure the root directory exists
if (!existsSync(GIT_REPOS_ROOT)) {
	mkdir(GIT_REPOS_ROOT, { recursive: true }).catch(() => {
		// Silently fail - directory creation errors will surface on use
	});
}

/**
 * Get the filesystem path for a repository
 */
export function getRepositoryPath(projectId: string, repositoryName: string): string {
	return join(GIT_REPOS_ROOT, projectId, `${repositoryName}.git`);
}

/**
 * Initialize a new bare git repository
 */
export async function initRepository(projectId: string, repositoryName: string, defaultBranch: string = 'main'): Promise<string> {
	const repoPath = getRepositoryPath(projectId, repositoryName);
	
	// Create directory structure
	await mkdir(dirname(repoPath), { recursive: true });
	
	// Initialize bare repository
	await execAsync(`git init --bare --initial-branch=${defaultBranch} "${repoPath}"`);
	
	return repoPath;
}

/**
 * Check if a repository exists on the filesystem
 */
export async function repositoryExists(repoPath: string): Promise<boolean> {
	try {
		await access(repoPath);
		const stats = await stat(repoPath);
		return stats.isDirectory();
	} catch {
		return false;
	}
}

/**
 * Get repository information from git
 */
export async function getRepositoryInfo(repoPath: string) {
	try {
		// Get default branch
		const { stdout: defaultBranch } = await execAsync(`git -C "${repoPath}" symbolic-ref --short HEAD || echo "main"`);
		
		// Get commit count
		const { stdout: commitCount } = await execAsync(`git -C "${repoPath}" rev-list --all --count || echo "0"`);
		
		// Get branch count
		const { stdout: branchCount } = await execAsync(`git -C "${repoPath}" branch -r | wc -l || echo "0"`);
		
		// Get tag count
		const { stdout: tagCount } = await execAsync(`git -C "${repoPath}" tag -l | wc -l || echo "0"`);
		
		// Get last commit info
		let lastCommitAt: Date | null = null;
		let lastCommitMessage: string | null = null;
		let lastCommitAuthor: string | null = null;
		
		try {
			const { stdout: lastCommit } = await execAsync(`git -C "${repoPath}" log -1 --format="%H|%at|%s|%an" || echo ""`);
			if (lastCommit.trim()) {
				const [hash, timestamp, message, author] = lastCommit.trim().split('|');
				lastCommitAt = new Date(parseInt(timestamp) * 1000);
				lastCommitMessage = message;
				lastCommitAuthor = author;
			}
		} catch {
			// No commits yet
		}
		
		// Get repository size
		const { stdout: sizeStr } = await execAsync(`du -sb "${repoPath}" | cut -f1 || echo "0"`);
		const size = parseInt(sizeStr.trim()) || 0;
		
		return {
			defaultBranch: defaultBranch.trim(),
			commitCount: parseInt(commitCount.trim()) || 0,
			branchCount: parseInt(branchCount.trim()) || 0,
			tagCount: parseInt(tagCount.trim()) || 0,
			lastCommitAt,
			lastCommitMessage,
			lastCommitAuthor,
			size
		};
	} catch (error) {
		return {
			defaultBranch: 'main',
			commitCount: 0,
			branchCount: 0,
			tagCount: 0,
			lastCommitAt: null,
			lastCommitMessage: null,
			lastCommitAuthor: null,
			size: 0
		};
	}
}

/**
 * Create a new git repository for a project
 */
export async function createRepository(data: {
	projectId: string;
	name: string;
	description?: string;
	isPrivate?: boolean;
	defaultBranch?: string;
}) {
	const { projectId, name, description, isPrivate = false, defaultBranch = 'main' } = data;
	
	// Initialize repository on filesystem
	const repositoryPath = await initRepository(projectId, name, defaultBranch);
	
	// Create database record
	const [repository] = await db.insert(gitRepositories).values({
		projectId,
		name,
		description: description || null,
		isPrivate,
		repositoryPath,
		...await getRepositoryInfo(repositoryPath)
	}).returning();
	
	return repository;
}

/**
 * Get repository by ID
 */
export async function getRepositoryById(repositoryId: string) {
	const [repository] = await db
		.select()
		.from(gitRepositories)
		.where(eq(gitRepositories.id, repositoryId))
		.limit(1);
	
	return repository || null;
}

/**
 * Get repository by project ID
 */
export async function getRepositoryByProjectId(projectId: string) {
	const [repository] = await db
		.select()
		.from(gitRepositories)
		.where(eq(gitRepositories.projectId, projectId))
		.limit(1);
	
	return repository || null;
}

/**
 * Get repository by namespace and repository name
 * Namespace can be a team name slug or username
 */
export async function getRepositoryByNamespace(namespace: string, repoName: string) {
	const { projects, teams } = await import('../db/schema');
	
	// Get all repositories with matching name and their teams
	const results = await db
		.select({
			repository: gitRepositories,
			project: projects,
			team: teams
		})
		.from(gitRepositories)
		.innerJoin(projects, eq(gitRepositories.projectId, projects.id))
		.leftJoin(teams, eq(projects.teamId, teams.id))
		.where(eq(gitRepositories.name, repoName));
	
	// Find matching namespace by comparing slugs
	const namespaceSlug = namespace.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	
	for (const result of results) {
		if (!result.team) continue;
		
		let teamSlug: string;
		if (result.team.personalTeam) {
			// Extract username from "John Doe's Team" -> "johndoe"
			const match = result.team.name.match(/^(.+?)'s Team$/i);
			if (match) {
				teamSlug = match[1].toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/^-|-$/g, '');
			} else {
				teamSlug = result.team.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
			}
		} else {
			teamSlug = result.team.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
		}
		
		if (teamSlug === namespaceSlug) {
			return result.repository;
		}
	}
	
	return null;
}

/**
 * Get namespace slug for a repository (team name or username)
 */
export async function getRepositoryNamespace(repositoryId: string): Promise<string | null> {
	try {
		const { projects, teams } = await import('../db/schema');
		
		const [result] = await db
			.select({
				team: teams,
				project: projects
			})
			.from(gitRepositories)
			.innerJoin(projects, eq(gitRepositories.projectId, projects.id))
			.leftJoin(teams, eq(projects.teamId, teams.id))
			.where(eq(gitRepositories.id, repositoryId))
			.limit(1);
		
		if (!result || !result.team) {
			return null;
		}
		
		// Create slug from team name
		// For personal teams like "John Doe's Team", extract "johndoe"
		const teamName = result.team.name;
		if (result.team.personalTeam) {
			// Extract username from "John Doe's Team" -> "johndoe"
			const match = teamName.match(/^(.+?)'s Team$/i);
			if (match) {
				return match[1].toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/^-|-$/g, '');
			}
		}
		
		// For regular teams, use team name as slug
		return teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	} catch (error) {
		// Silently fail - return null if namespace can't be determined
		return null;
	}
}

/**
 * Update repository statistics
 */
export async function updateRepositoryStats(repositoryId: string) {
	const repository = await getRepositoryById(repositoryId);
	if (!repository) {
		throw new Error('Repository not found');
	}
	
	const stats = await getRepositoryInfo(repository.repositoryPath);
	
	await db
		.update(gitRepositories)
		.set({
			...stats,
			updatedAt: new Date()
		})
		.where(eq(gitRepositories.id, repositoryId));
}

/**
 * Update repository settings
 */
export async function updateRepositorySettings(
	repositoryId: string,
	settings: {
		name?: string;
		description?: string | null;
		isPrivate?: boolean;
		allowHttpPush?: boolean;
		allowSshPush?: boolean;
		isTemplate?: boolean;
		isReadOnly?: boolean;
	}
) {
	const [updated] = await db
		.update(gitRepositories)
		.set({
			...settings,
			updatedAt: new Date()
		})
		.where(eq(gitRepositories.id, repositoryId))
		.returning();
	
	if (!updated) {
		throw new Error('Repository not found');
	}
	
	return updated;
}

/**
 * Delete a repository
 */
export async function deleteRepository(repositoryId: string) {
	const repository = await getRepositoryById(repositoryId);
	if (!repository) {
		throw new Error('Repository not found');
	}
	
	// Delete from database (cascade will handle collaborators)
	await db.delete(gitRepositories).where(eq(gitRepositories.id, repositoryId));
	
	// TODO: Delete filesystem repository (use rimraf or similar)
	// For now, we'll leave it for manual cleanup
}

/**
 * Calculate SSH key fingerprint
 */
export function calculateFingerprint(publicKey: string): string {
	// Extract the key part (remove key type and comment)
	const parts = publicKey.trim().split(' ');
	if (parts.length < 2) {
		throw new Error('Invalid public key format');
	}
	
	const keyData = parts[1];
	const keyBuffer = Buffer.from(keyData, 'base64');
	const hash = createHash('sha256').update(keyBuffer).digest('base64');
	
	// Format as SSH fingerprint (SHA256:...)
	return `SHA256:${hash}`;
}

/**
 * Add SSH key for a user
 */
export async function addSshKey(userId: string, title: string, publicKey: string) {
	// Validate and parse key
	const parts = publicKey.trim().split(' ');
	if (parts.length < 2) {
		throw new Error('Invalid public key format');
	}
	
	const keyType = parts[0];
	const fingerprint = calculateFingerprint(publicKey);
	
	// Check if key already exists
	const existing = await db
		.select()
		.from(sshKeys)
		.where(eq(sshKeys.fingerprint, fingerprint))
		.limit(1);
	
	if (existing.length > 0) {
		throw new Error('SSH key already exists');
	}
	
	// Insert key
	const [key] = await db.insert(sshKeys).values({
		userId,
		title,
		publicKey,
		keyType,
		fingerprint
	}).returning();
	
	return key;
}

/**
 * Get SSH keys for a user
 */
export async function getUserSshKeys(userId: string) {
	return db
		.select()
		.from(sshKeys)
		.where(eq(sshKeys.userId, userId));
}

/**
 * Get SSH key by fingerprint
 */
export async function getSshKeyByFingerprint(fingerprint: string) {
	const [key] = await db
		.select()
		.from(sshKeys)
		.where(eq(sshKeys.fingerprint, fingerprint))
		.limit(1);
	
	return key || null;
}

/**
 * Delete SSH key
 */
export async function deleteSshKey(keyId: string, userId: string) {
	await db
		.delete(sshKeys)
		.where(and(
			eq(sshKeys.id, keyId),
			eq(sshKeys.userId, userId)
		));
}

/**
 * Check if user has access to repository
 */
export async function hasRepositoryAccess(
	repositoryId: string,
	userId: string,
	teamIds: string[],
	requiredPermission: 'read' | 'write' | 'admin'
): Promise<boolean> {
	const repository = await getRepositoryById(repositoryId);
	if (!repository) {
		return false;
	}
	
	// Check collaborators
	const collaborators = await db
		.select()
		.from(repositoryCollaborators)
		.where(eq(repositoryCollaborators.repositoryId, repositoryId));
	
	// Check user direct access
	const userAccess = collaborators.find(c => 
		c.collaboratorType === 'user' && c.collaboratorId === userId
	);
	
	if (userAccess) {
		if (requiredPermission === 'read' && userAccess.canRead) return true;
		if (requiredPermission === 'write' && userAccess.canWrite) return true;
		if (requiredPermission === 'admin' && userAccess.canAdmin) return true;
	}
	
	// Check team access
	const teamAccess = collaborators.find(c => 
		c.collaboratorType === 'team' && teamIds.includes(c.collaboratorId)
	);
	
	if (teamAccess) {
		if (requiredPermission === 'read' && teamAccess.canRead) return true;
		if (requiredPermission === 'write' && teamAccess.canWrite) return true;
		if (requiredPermission === 'admin' && teamAccess.canAdmin) return true;
	}
	
	// If repository is not private, allow read access
	if (!repository.isPrivate && requiredPermission === 'read') {
		return true;
	}
	
	return false;
}
