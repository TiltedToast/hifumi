ALTER TABLE `error_logs` MODIFY COLUMN `server` varchar(255);--> statement-breakpoint
ALTER TABLE `error_logs` MODIFY COLUMN `channel` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `error_logs` MODIFY COLUMN `user` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `miku_command_aliases` MODIFY COLUMN `command` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `miku_command_aliases` MODIFY COLUMN `alias` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `miku_reactions` MODIFY COLUMN `command` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `prefixes` MODIFY COLUMN `server_id` varchar(255) NOT NULL;