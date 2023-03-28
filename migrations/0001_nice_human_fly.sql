-- Active: 1679011206941@@127.0.0.1@3306@hifumi
CREATE TABLE `reddit_posts` (
	`id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`subreddit` varchar(255) NOT NULL,
	`title` TEXT NOT NULL,
	`url` text NOT NULL,
	`over_18` boolean NOT NULL,
	`permalink` text NOT NULL
);

CREATE INDEX subreddit ON reddit_posts (`subreddit`);
CREATE INDEX over_18 ON reddit_posts (`over_18`);
