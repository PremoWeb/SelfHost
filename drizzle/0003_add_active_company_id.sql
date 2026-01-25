-- Add activeCompanyId to sessions table for company context switching

--> statement-breakpoint
ALTER TABLE `session` ADD `active_company_id` text REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null;
