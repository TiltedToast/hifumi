DROP INDEX `subreddit` ON `reddit_posts`;--> statement-breakpoint
CREATE INDEX `subreddit_idx` ON `reddit_posts` (`subreddit`);