-- Multi-Tenant Architecture Migration
-- Adds companies, project categories, assignments, resource sharing, billing, and updates existing tables

--> statement-breakpoint
-- Companies table
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`slug` text NOT NULL UNIQUE,
	`created_by` text NOT NULL,
	`billing_profile_id` text,
	`settings` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);

--> statement-breakpoint
-- Company Members table
CREATE TABLE `company_members` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
-- Project Categories table
CREATE TABLE `project_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`parent_id` text,
	`tags` text DEFAULT '[]',
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `project_categories`(`id`) ON UPDATE no action ON DELETE set null
);

--> statement-breakpoint
-- Project Assignments table
CREATE TABLE `project_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`assignee_type` text NOT NULL,
	`assignee_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
-- Company Resource Shares table
CREATE TABLE `company_resource_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`owner_company_id` text NOT NULL,
	`shared_with_company_id` text NOT NULL,
	`permissions` text DEFAULT '{}' NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shared_with_company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);

--> statement-breakpoint
-- Billing Profiles table
CREATE TABLE `billing_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`company_id` text,
	`billing_email` text,
	`billing_address` text DEFAULT '{}',
	`payment_method` text DEFAULT '{}',
	`settings` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null
);

--> statement-breakpoint
-- Project Category Collaborations table
CREATE TABLE `project_category_collaborations` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`company_id` text NOT NULL,
	`can_create_projects` integer DEFAULT false NOT NULL,
	`can_view_projects` integer DEFAULT false NOT NULL,
	`can_manage_projects` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `project_categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
-- Add isGod to users table
ALTER TABLE `users` ADD `is_god` integer DEFAULT false NOT NULL;

--> statement-breakpoint
-- Modify teams table - add companyId (nullable for backward compatibility)
-- Note: SQLite doesn't support adding foreign keys via ALTER TABLE, so we just add the column
ALTER TABLE `teams` ADD `company_id` text;

--> statement-breakpoint
-- Modify projects table - add new fields, make teamId nullable
-- Note: SQLite doesn't support adding foreign keys via ALTER TABLE, so we just add the columns
ALTER TABLE `projects` ADD `category_id` text;
ALTER TABLE `projects` ADD `billing_profile_id` text;
ALTER TABLE `projects` ADD `company_id` text;
-- Note: teamId is kept for backward compatibility but will be phased out

--> statement-breakpoint
-- Modify VPS Providers - add ownerType and ownerId, make teamId nullable
ALTER TABLE `vps_providers` ADD `owner_type` text;
ALTER TABLE `vps_providers` ADD `owner_id` text;
-- teamId kept for backward compatibility

--> statement-breakpoint
-- Modify Servers - add ownerType and ownerId, keep teamId for backward compatibility
ALTER TABLE `servers` ADD `owner_type` text;
ALTER TABLE `servers` ADD `owner_id` text;

--> statement-breakpoint
-- Modify Domains - add ownerType and ownerId, keep teamId for backward compatibility
ALTER TABLE `domains` ADD `owner_type` text;
ALTER TABLE `domains` ADD `owner_id` text;

--> statement-breakpoint
-- Modify Destinations - add ownerType and ownerId, keep teamId for backward compatibility
ALTER TABLE `destinations` ADD `owner_type` text;
ALTER TABLE `destinations` ADD `owner_id` text;

--> statement-breakpoint
-- Modify Sources - add ownerType and ownerId, keep teamId for backward compatibility
ALTER TABLE `sources` ADD `owner_type` text;
ALTER TABLE `sources` ADD `owner_id` text;

--> statement-breakpoint
-- Modify S3 Storages - add ownerType and ownerId, keep teamId for backward compatibility
ALTER TABLE `s3_storages` ADD `owner_type` text;
ALTER TABLE `s3_storages` ADD `owner_id` text;

--> statement-breakpoint
-- Modify Private Keys - add ownerType and ownerId, keep teamId for backward compatibility
ALTER TABLE `private_keys` ADD `owner_type` text;
ALTER TABLE `private_keys` ADD `owner_id` text;

--> statement-breakpoint
-- Modify API Tokens - add ownerType and ownerId, keep teamId for backward compatibility
ALTER TABLE `api_tokens` ADD `owner_type` text;
ALTER TABLE `api_tokens` ADD `owner_id` text;

--> statement-breakpoint
-- Modify Shared Variables - add ownerType and ownerId, keep teamId for backward compatibility
ALTER TABLE `shared_variables` ADD `owner_type` text;
ALTER TABLE `shared_variables` ADD `owner_id` text;

--> statement-breakpoint
-- Modify Clients - add companyId (optional), keep teamId for backward compatibility
-- Note: SQLite doesn't support adding foreign keys via ALTER TABLE, so we just add the column
ALTER TABLE `clients` ADD `company_id` text;

--> statement-breakpoint
-- Create indexes for better performance
CREATE INDEX `company_members_company_id_idx` ON `company_members` (`company_id`);
CREATE INDEX `company_members_user_id_idx` ON `company_members` (`user_id`);
CREATE INDEX `project_assignments_project_id_idx` ON `project_assignments` (`project_id`);
CREATE INDEX `project_assignments_assignee_idx` ON `project_assignments` (`assignee_type`, `assignee_id`);
CREATE INDEX `company_resource_shares_owner_idx` ON `company_resource_shares` (`owner_company_id`);
CREATE INDEX `company_resource_shares_shared_with_idx` ON `company_resource_shares` (`shared_with_company_id`);
CREATE INDEX `project_category_collaborations_category_idx` ON `project_category_collaborations` (`category_id`);
CREATE INDEX `project_category_collaborations_company_idx` ON `project_category_collaborations` (`company_id`);
