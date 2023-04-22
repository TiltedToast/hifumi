CREATE TABLE `error_logs` (
    `id` int AUTO_INCREMENT PRIMARY KEY,
    `server` varchar(25),
    `channel` varchar(25) NOT NULL,
    `user` varchar(25) NOT NULL,
    `command` text,
    `stack` text,
    `timestamp` timestamp DEFAULT (NOW()),
    `log` text,
    `error` text
);

--> statement-breakpoint
CREATE TABLE `help_messages` (
    `id` int AUTO_INCREMENT PRIMARY KEY,
    `cmd` varchar(100) NOT NULL,
    `desc` varchar(255) NOT NULL
);

--> statement-breakpoint
CREATE TABLE `leet` (
    `id` int AUTO_INCREMENT PRIMARY KEY,
    `source` char(1) NOT NULL,
    `translated` varchar(10) NOT NULL
);

--> statement-breakpoint
CREATE TABLE `miku_command_aliases` (
    `id` int AUTO_INCREMENT PRIMARY KEY,
    `command` varchar(25) NOT NULL,
    `alias` varchar(25) NOT NULL
);

--> statement-breakpoint
CREATE TABLE `miku_reactions` (
    `id` int AUTO_INCREMENT PRIMARY KEY,
    `command` varchar(50) NOT NULL,
    `reaction` varchar(255) NOT NULL
);

--> statement-breakpoint
CREATE TABLE `prefixes` (
    `id` int AUTO_INCREMENT PRIMARY KEY,
    `server_id` varchar(25) NOT NULL,
    `prefix` varchar(255) NOT NULL,
    UNIQUE KEY `server_id` (`server_id`)
);

--> statement-breakpoint
CREATE TABLE `reddit_posts` (
    `id` int AUTO_INCREMENT PRIMARY KEY,
    `subreddit` varchar(50) NOT NULL,
    `title` text NOT NULL,
    `url` varchar(255) NOT NULL,
    `over_18` boolean NOT NULL,
    `permalink` varchar(255) NOT NULL,
    KEY `subreddit` (`subreddit`)
);

--> statement-breakpoint
CREATE TABLE `statuses` (
    `id` int NOT NULL AUTO_INCREMENT,
    `type` varchar(20) NOT NULL,
    `status` varchar(255) NOT NULL,
    PRIMARY KEY (`type`, `status`),
    CONSTRAINT `valid_activity_type` CHECK (
        (
            (
                `type` IN (
                    'PLAYING',
                    'WATCHING',
                    'STREAMING',
                    'LISTENING',
                    'COMPETING'
                )
            )
            AND (
                cast(`type` AS char CHARSET binary) = upper(`type`)
            )
        )
    )
)