CREATE TABLE `currencies` (
    `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
    `code` char(3) NOT NULL,
    `long_name` varchar(50) NOT NULL
);

CREATE TABLE `error_logs` (
    `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
    `server` varchar(50),
    `channel` varchar(50) NOT NULL,
    `user` varchar(50) NOT NULL,
    `command` text,
    `stack` text,
    `timestamp` timestamp DEFAULT (NOW()),
    `log` text,
    `error` text
);

CREATE TABLE `help_messages` (
    `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
    `cmd` varchar(255) NOT NULL,
    `desc` varchar(255) NOT NULL
);

CREATE TABLE `leet` (
    `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
    `source` char(1) NOT NULL,
    `translated` varchar(50) NOT NULL
);

CREATE TABLE `miku_reaction_aliases` (
    `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
    `command` varchar(50) NOT NULL,
    `alias` varchar(50) NOT NULL
);

CREATE TABLE `miku_reactions` (
    `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
    `command` varchar(50) NOT NULL,
    `reaction` varchar(255) NOT NULL
);

CREATE TABLE `prefixes` (
    `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
    `server_id` varchar(50) NOT NULL,
    `prefix` varchar(255) NOT NULL
);

CREATE TABLE `statuses` (
    `id` int AUTO_INCREMENT NOT NULL,
    `type` varchar(20) NOT NULL,
    `status` varchar(255) NOT NULL
);

ALTER TABLE
    `statuses`
ADD
    PRIMARY KEY(`type`, `status`);

CREATE UNIQUE INDEX server_id ON prefixes (`server_id`);

CREATE INDEX id ON statuses (`id`);