CREATE TABLE `nameserver_profile_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`assignee_type` text NOT NULL,
	`assignee_id` text NOT NULL,
	`role` text DEFAULT 'use' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `nameserver_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
