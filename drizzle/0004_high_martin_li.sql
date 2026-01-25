ALTER TABLE `git_repositories` ADD `is_template` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `git_repositories` ADD `is_read_only` integer DEFAULT false NOT NULL;