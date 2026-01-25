CREATE TABLE `git_repositories` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_private` integer DEFAULT false NOT NULL,
	`repository_path` text NOT NULL,
	`default_branch` text DEFAULT 'main' NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`commit_count` integer DEFAULT 0 NOT NULL,
	`branch_count` integer DEFAULT 0 NOT NULL,
	`tag_count` integer DEFAULT 0 NOT NULL,
	`last_commit_at` integer,
	`last_commit_message` text,
	`last_commit_author` text,
	`allow_http_push` integer DEFAULT true NOT NULL,
	`allow_ssh_push` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `git_repositories_repository_path_unique` ON `git_repositories` (`repository_path`);--> statement-breakpoint
CREATE TABLE `repository_collaborators` (
	`id` text PRIMARY KEY NOT NULL,
	`repository_id` text NOT NULL,
	`collaborator_type` text NOT NULL,
	`collaborator_id` text NOT NULL,
	`can_read` integer DEFAULT true NOT NULL,
	`can_write` integer DEFAULT false NOT NULL,
	`can_admin` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`repository_id`) REFERENCES `git_repositories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ssh_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`public_key` text NOT NULL,
	`key_type` text NOT NULL,
	`fingerprint` text NOT NULL,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ssh_keys_fingerprint_unique` ON `ssh_keys` (`fingerprint`);