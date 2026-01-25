CREATE TABLE `cloudflare_access_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`client_id` text NOT NULL,
	`client_secret` text NOT NULL,
	`team_id` text,
	`owner_type` text,
	`owner_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_dns_records` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`value` text,
	`ttl` integer DEFAULT 3600 NOT NULL,
	`priority` integer,
	`sync_mode` text DEFAULT 'static' NOT NULL,
	`server_id` text,
	`sync_tag` text,
	`team_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_dns_records`("id", "domain_id", "type", "name", "value", "ttl", "priority", "sync_mode", "server_id", "sync_tag", "team_id", "created_at", "updated_at") SELECT "id", "domain_id", "type", "name", "value", "ttl", "priority", "sync_mode", "server_id", "sync_tag", "team_id", "created_at", "updated_at" FROM `dns_records`;--> statement-breakpoint
DROP TABLE `dns_records`;--> statement-breakpoint
ALTER TABLE `__new_dns_records` RENAME TO `dns_records`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `servers` ADD `cloudflare_tunnel_hostname` text;--> statement-breakpoint
ALTER TABLE `servers` ADD `cloudflare_access_token_id` text REFERENCES cloudflare_access_tokens(id);--> statement-breakpoint
ALTER TABLE `vps_providers` ADD `dns_enabled` integer DEFAULT false NOT NULL;