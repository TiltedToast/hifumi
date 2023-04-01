-- Active: 1680103388165@@aws.connect.psdb.cloud@3306@hifumi
ALTER TABLE error_logs MODIFY COLUMN `server` varchar(25);
ALTER TABLE error_logs MODIFY COLUMN `channel` varchar(25) NOT NULL;
ALTER TABLE error_logs MODIFY COLUMN `user` varchar(25) NOT NULL;
ALTER TABLE help_messages MODIFY COLUMN `cmd` varchar(100) NOT NULL;
ALTER TABLE leet MODIFY COLUMN `translated` varchar(10) NOT NULL;
ALTER TABLE miku_command_aliases MODIFY COLUMN `command` varchar(25) NOT NULL;
ALTER TABLE miku_command_aliases MODIFY COLUMN `alias` varchar(25) NOT NULL;
ALTER TABLE prefixes MODIFY COLUMN `server_id` varchar(25) NOT NULL;
ALTER TABLE prefixes MODIFY COLUMN `prefix` varchar(25) NOT NULL;