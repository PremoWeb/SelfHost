-- Make team_id nullable in private_keys and api_tokens tables
-- SQLite doesn't support ALTER COLUMN, so we need to recreate the tables

--> statement-breakpoint
-- Recreate private_keys table with nullable team_id
CREATE TABLE `private_keys_new` (
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

INSERT INTO `private_keys_new` SELECT * FROM `private_keys`;

DROP TABLE `private_keys`;

ALTER TABLE `private_keys_new` RENAME TO `private_keys`;

--> statement-breakpoint
-- Recreate api_tokens table with nullable team_id
CREATE TABLE `api_tokens_new` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`token` text NOT NULL UNIQUE,
	`team_id` text,
	`owner_type` text,
	`owner_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);

INSERT INTO `api_tokens_new` SELECT * FROM `api_tokens`;

DROP TABLE `api_tokens`;

ALTER TABLE `api_tokens_new` RENAME TO `api_tokens`;
