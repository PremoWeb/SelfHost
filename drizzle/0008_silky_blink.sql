CREATE TABLE `domain_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text NOT NULL,
	`assignee_type` text NOT NULL,
	`assignee_id` text NOT NULL,
	`role` text DEFAULT 'use' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `website_mode` integer DEFAULT false NOT NULL;