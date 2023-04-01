-- Active: 1680103388165@@aws.connect.psdb.cloud@3306@hifumi
ALTER TABLE reddit_posts MODIFY COLUMN `url` varchar(255) NOT NULL;
ALTER TABLE reddit_posts MODIFY COLUMN `permalink` varchar(255) NOT NULL;