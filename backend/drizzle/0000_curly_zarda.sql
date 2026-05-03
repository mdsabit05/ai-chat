CREATE TABLE `chats` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text,
	`role` text,
	`content` text
);
