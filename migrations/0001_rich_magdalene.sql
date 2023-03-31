-- Active: 1680103388165@@aws.connect.psdb.cloud@3306@hifumi
CREATE TABLE `miku_command_aliases` (
	`id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`command` varchar(50) NOT NULL,
	`alias` varchar(50) NOT NULL
);

DROP TABLE miku_reaction_aliases;