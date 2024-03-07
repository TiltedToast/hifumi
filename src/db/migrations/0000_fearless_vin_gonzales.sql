CREATE TABLE `error_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`server` text(255),
	`channel` text(255) NOT NULL,
	`user` text(255) NOT NULL,
	`command` text,
	`stack` text,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP,
	`log` text,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `help_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cmd` text(100) NOT NULL,
	`desc` text(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leet` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text(1) NOT NULL,
	`translated` text(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `miku_command_aliases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`command` text(255) NOT NULL,
	`alias` text(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `miku_reactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`command` text(255) NOT NULL,
	`reaction` text(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prefixes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`server_id` text(255) NOT NULL,
	`prefix` text(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reddit_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subreddit` text(50) NOT NULL,
	`title` text(255) NOT NULL,
	`url` text(255) NOT NULL,
	`over_18` integer NOT NULL,
	`permalink` text(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `statuses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text(20) NOT NULL,
	`status` text(128) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prefixes_server_id_unique` ON `prefixes` (`server_id`);--> statement-breakpoint
CREATE INDEX `subreddit_idx` ON `reddit_posts` (`subreddit`);--> statement-breakpoint
CREATE INDEX `id` ON `statuses` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_type_status` ON `statuses` (`type`,`status`);