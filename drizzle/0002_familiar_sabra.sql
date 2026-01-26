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
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`slug` text NOT NULL,
	`created_by` text NOT NULL,
	`billing_profile_id` text,
	`settings` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_slug_unique` ON `companies` (`slug`);--> statement-breakpoint
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
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`token` text NOT NULL,
	`team_id` text,
	`owner_type` text,
	`owner_id` text,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_api_tokens`("id", "name", "description", "token", "team_id", "owner_type", "owner_id", "last_used_at", "created_at", "updated_at") SELECT "id", "name", "description", "token", "team_id", NULL, NULL, "last_used_at", "created_at", "updated_at" FROM `api_tokens`;--> statement-breakpoint
DROP TABLE `api_tokens`;--> statement-breakpoint
ALTER TABLE `__new_api_tokens` RENAME TO `api_tokens`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_unique` ON `api_tokens` (`token`);--> statement-breakpoint
CREATE TABLE `__new_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`company` text,
	`team_id` text,
	`company_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_clients`("id", "name", "email", "phone", "company", "team_id", "company_id", "created_at", "updated_at") SELECT "id", "name", "email", "phone", "company", "team_id", NULL, "created_at", "updated_at" FROM `clients`;--> statement-breakpoint
DROP TABLE `clients`;--> statement-breakpoint
ALTER TABLE `__new_clients` RENAME TO `clients`;--> statement-breakpoint
CREATE TABLE `__new_destinations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`network` text DEFAULT 'selfhost' NOT NULL,
	`server_id` text NOT NULL,
	`team_id` text,
	`owner_type` text,
	`owner_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_destinations`("id", "name", "description", "type", "network", "server_id", "team_id", "owner_type", "owner_id", "created_at", "updated_at") SELECT "id", "name", "description", "type", "network", "server_id", "team_id", NULL, NULL, "created_at", "updated_at" FROM `destinations`;--> statement-breakpoint
DROP TABLE `destinations`;--> statement-breakpoint
ALTER TABLE `__new_destinations` RENAME TO `destinations`;--> statement-breakpoint
CREATE TABLE `__new_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`provider` text DEFAULT 'custom' NOT NULL,
	`team_id` text,
	`owner_type` text,
	`owner_id` text,
	`nameserver_profile_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`nameserver_profile_id`) REFERENCES `nameserver_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_domains`("id", "name", "provider", "team_id", "owner_type", "owner_id", "nameserver_profile_id", "created_at", "updated_at") SELECT "id", "name", "provider", "team_id", NULL, NULL, "nameserver_profile_id", "created_at", "updated_at" FROM `domains`;--> statement-breakpoint
DROP TABLE `domains`;--> statement-breakpoint
ALTER TABLE `__new_domains` RENAME TO `domains`;--> statement-breakpoint
CREATE TABLE `__new_private_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`private_key` text NOT NULL,
	`team_id` text,
	`owner_type` text,
	`owner_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_private_keys`("id", "name", "description", "private_key", "team_id", "owner_type", "owner_id", "created_at", "updated_at") SELECT "id", "name", "description", "private_key", "team_id", NULL, NULL, "created_at", "updated_at" FROM `private_keys`;--> statement-breakpoint
DROP TABLE `private_keys`;--> statement-breakpoint
ALTER TABLE `__new_private_keys` RENAME TO `private_keys`;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`team_id` text,
	`client_id` text,
	`category_id` text,
	`billing_profile_id` text,
	`company_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `project_categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`billing_profile_id`) REFERENCES `billing_profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "name", "description", "team_id", "client_id", "category_id", "billing_profile_id", "company_id", "created_at", "updated_at") SELECT "id", "name", "description", "team_id", "client_id", NULL, NULL, NULL, "created_at", "updated_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
CREATE TABLE `__new_s3_storages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`endpoint` text NOT NULL,
	`region` text NOT NULL,
	`bucket` text NOT NULL,
	`access_key` text NOT NULL,
	`secret_key` text NOT NULL,
	`team_id` text,
	`owner_type` text,
	`owner_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_s3_storages`("id", "name", "description", "endpoint", "region", "bucket", "access_key", "secret_key", "team_id", "owner_type", "owner_id", "created_at", "updated_at") SELECT "id", "name", "description", "endpoint", "region", "bucket", "access_key", "secret_key", "team_id", NULL, NULL, "created_at", "updated_at" FROM `s3_storages`;--> statement-breakpoint
DROP TABLE `s3_storages`;--> statement-breakpoint
ALTER TABLE `__new_s3_storages` RENAME TO `s3_storages`;--> statement-breakpoint
CREATE TABLE `__new_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`ip` text NOT NULL,
	`ipv6` text,
	`port` integer DEFAULT 22 NOT NULL,
	`user` text DEFAULT 'root' NOT NULL,
	`status` text DEFAULT 'offline' NOT NULL,
	`tags` text DEFAULT '[]',
	`team_id` text,
	`owner_type` text,
	`owner_id` text,
	`private_key_id` text,
	`connection_type` text DEFAULT 'ssh' NOT NULL,
	`agent_key` text,
	`agent_checksum` text,
	`agent_version` text,
	`agent_installed_at` integer,
	`vps_provider_id` text,
	`health_cpu` integer DEFAULT 0,
	`health_memory` integer DEFAULT 0,
	`health_disk` integer DEFAULT 0,
	`health_updated_at` integer,
	`proxy_type` text DEFAULT 'none' NOT NULL,
	`proxy_status` text DEFAULT 'stopped' NOT NULL,
	`proxy_last_applied_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`private_key_id`) REFERENCES `private_keys`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`vps_provider_id`) REFERENCES `vps_providers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_servers`("id", "name", "description", "ip", "ipv6", "port", "user", "status", "tags", "team_id", "owner_type", "owner_id", "private_key_id", "connection_type", "agent_key", "agent_checksum", "agent_version", "agent_installed_at", "vps_provider_id", "health_cpu", "health_memory", "health_disk", "health_updated_at", "proxy_type", "proxy_status", "proxy_last_applied_at", "created_at", "updated_at") SELECT "id", "name", "description", "ip", "ipv6", "port", "user", "status", "tags", "team_id", NULL, NULL, "private_key_id", "connection_type", "agent_key", "agent_checksum", "agent_version", "agent_installed_at", "vps_provider_id", "health_cpu", "health_memory", "health_disk", "health_updated_at", "proxy_type", "proxy_status", "proxy_last_applied_at", "created_at", "updated_at" FROM `servers`;--> statement-breakpoint
DROP TABLE `servers`;--> statement-breakpoint
ALTER TABLE `__new_servers` RENAME TO `servers`;--> statement-breakpoint
CREATE TABLE `__new_shared_variables` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`team_id` text,
	`owner_type` text,
	`owner_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_shared_variables`("id", "key", "value", "is_public", "team_id", "owner_type", "owner_id", "created_at", "updated_at") SELECT "id", "key", "value", "is_public", "team_id", NULL, NULL, "created_at", "updated_at" FROM `shared_variables`;--> statement-breakpoint
DROP TABLE `shared_variables`;--> statement-breakpoint
ALTER TABLE `__new_shared_variables` RENAME TO `shared_variables`;--> statement-breakpoint
CREATE TABLE `__new_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`api_url` text,
	`html_url` text,
	`token` text,
	`is_app` integer DEFAULT false NOT NULL,
	`app_id` text,
	`installation_id` text,
	`client_id` text,
	`client_secret` text,
	`private_key` text,
	`webhook_secret` text,
	`team_id` text,
	`owner_type` text,
	`owner_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_sources`("id", "name", "description", "type", "api_url", "html_url", "token", "is_app", "app_id", "installation_id", "client_id", "client_secret", "private_key", "webhook_secret", "team_id", "owner_type", "owner_id", "created_at", "updated_at") SELECT "id", "name", "description", "type", "api_url", "html_url", "token", "is_app", "app_id", "installation_id", "client_id", "client_secret", "private_key", "webhook_secret", "team_id", NULL, NULL, "created_at", "updated_at" FROM `sources`;--> statement-breakpoint
DROP TABLE `sources`;--> statement-breakpoint
ALTER TABLE `__new_sources` RENAME TO `sources`;--> statement-breakpoint
CREATE TABLE `__new_vps_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`api_key` text NOT NULL,
	`team_id` text,
	`owner_type` text,
	`owner_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_vps_providers`("id", "name", "type", "api_key", "team_id", "owner_type", "owner_id", "created_at", "updated_at") SELECT "id", "name", "type", "api_key", "team_id", NULL, NULL, "created_at", "updated_at" FROM `vps_providers`;--> statement-breakpoint
DROP TABLE `vps_providers`;--> statement-breakpoint
ALTER TABLE `__new_vps_providers` RENAME TO `vps_providers`;--> statement-breakpoint
ALTER TABLE `session` ADD `impersonated_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `session` ADD `active_company_id` text REFERENCES companies(id);--> statement-breakpoint
ALTER TABLE `teams` ADD `company_id` text REFERENCES companies(id);--> statement-breakpoint
ALTER TABLE `users` ADD `is_god` integer DEFAULT false NOT NULL;