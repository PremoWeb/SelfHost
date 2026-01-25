import { db } from '../db/client';
import { projectCategories, projectCategoryCollaborations, companies } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { NewProjectCategory, NewProjectCategoryCollaboration } from '../db/schema';

/**
 * Create a project category
 */
export async function createCategory(data: {
	name: string;
	slug?: string;
	description?: string;
	parentId?: string | null;
	tags?: string[];
	metadata?: Record<string, any>;
}) {
	const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

	const [category] = await db
		.insert(projectCategories)
		.values({
			name: data.name,
			slug,
			description: data.description,
			parentId: data.parentId || null,
			tags: data.tags || [],
			metadata: data.metadata || {}
		})
		.returning();

	return category;
}

/**
 * Get category by ID
 */
export async function getCategoryById(id: string) {
	return await db.query.projectCategories.findFirst({
		where: eq(projectCategories.id, id),
		with: {
			parent: true,
			children: true,
			collaborations: {
				with: {
					company: true
				}
			}
		}
	});
}

/**
 * Get category tree (all categories with hierarchy)
 */
export async function getCategoryTree() {
	const allCategories = await db.query.projectCategories.findMany({
		with: {
			parent: true,
			children: true
		},
		orderBy: (categories, { asc }) => [asc(categories.name)]
	});

	// Build tree structure
	const categoryMap = new Map(allCategories.map((cat) => [cat.id, { ...cat, children: [] }]));
	const rootCategories: any[] = [];

	for (const category of allCategories) {
		const node = categoryMap.get(category.id)!;
		if (category.parentId) {
			const parent = categoryMap.get(category.parentId);
			if (parent) {
				parent.children.push(node);
			} else {
				// Orphaned category, add to root
				rootCategories.push(node);
			}
		} else {
			rootCategories.push(node);
		}
	}

	return rootCategories;
}

/**
 * Get categories by tags
 */
export async function getCategoriesByTags(tags: string[]) {
	const allCategories = await db.query.projectCategories.findMany();
	return allCategories.filter((cat) => {
		const categoryTags = (cat.tags || []) as string[];
		return tags.some((tag) => categoryTags.includes(tag));
	});
}

/**
 * Update category
 */
export async function updateCategory(
	id: string,
	data: {
		name?: string;
		slug?: string;
		description?: string;
		parentId?: string | null;
		tags?: string[];
		metadata?: Record<string, any>;
	}
) {
	const updateData: any = {};
	if (data.name !== undefined) updateData.name = data.name;
	if (data.slug !== undefined) updateData.slug = data.slug;
	if (data.description !== undefined) updateData.description = data.description;
	if (data.parentId !== undefined) updateData.parentId = data.parentId;
	if (data.tags !== undefined) updateData.tags = data.tags;
	if (data.metadata !== undefined) updateData.metadata = data.metadata;
	updateData.updatedAt = new Date();

	const [category] = await db.update(projectCategories).set(updateData).where(eq(projectCategories.id, id)).returning();
	return category;
}

/**
 * Delete category
 */
export async function deleteCategory(id: string) {
	await db.delete(projectCategories).where(eq(projectCategories.id, id));
}

/**
 * Add company collaboration to a category
 */
export async function addCategoryCollaboration(
	categoryId: string,
	companyId: string,
	permissions: {
		canCreateProjects?: boolean;
		canViewProjects?: boolean;
		canManageProjects?: boolean;
	}
) {
	// Check if collaboration already exists
	const existing = await db
		.select()
		.from(projectCategoryCollaborations)
		.where(and(eq(projectCategoryCollaborations.categoryId, categoryId), eq(projectCategoryCollaborations.companyId, companyId)))
		.limit(1);

	if (existing.length > 0) {
		// Update existing collaboration
		const [collab] = await db
			.update(projectCategoryCollaborations)
			.set({
				canCreateProjects: permissions.canCreateProjects ?? false,
				canViewProjects: permissions.canViewProjects ?? false,
				canManageProjects: permissions.canManageProjects ?? false
			})
			.where(
				and(
					eq(projectCategoryCollaborations.categoryId, categoryId),
					eq(projectCategoryCollaborations.companyId, companyId)
				)
			)
			.returning();
		return collab;
	}

	// Create new collaboration
	const [collab] = await db
		.insert(projectCategoryCollaborations)
		.values({
			categoryId,
			companyId,
			canCreateProjects: permissions.canCreateProjects ?? false,
			canViewProjects: permissions.canViewProjects ?? false,
			canManageProjects: permissions.canManageProjects ?? false
		})
		.returning();

	return collab;
}

/**
 * Remove company collaboration from a category
 */
export async function removeCategoryCollaboration(categoryId: string, companyId: string) {
	await db
		.delete(projectCategoryCollaborations)
		.where(
			and(
				eq(projectCategoryCollaborations.categoryId, categoryId),
				eq(projectCategoryCollaborations.companyId, companyId)
			)
		);
}

/**
 * Get collaborations for a category
 */
export async function getCategoryCollaborations(categoryId: string) {
	return await db
		.select({
			collaboration: projectCategoryCollaborations,
			company: companies
		})
		.from(projectCategoryCollaborations)
		.innerJoin(companies, eq(projectCategoryCollaborations.companyId, companies.id))
		.where(eq(projectCategoryCollaborations.categoryId, categoryId));
}
