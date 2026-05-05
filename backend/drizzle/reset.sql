CREATE TABLE IF NOT EXISTS `user` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `password` text NOT NULL,
  `name` text,
  `created_at` integer,
  `updated_at` integer
);

CREATE UNIQUE INDEX IF NOT EXISTS `user_email_unique` ON `user` (`email`);

CREATE TABLE IF NOT EXISTS `chats` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text,
  `user_id` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `messages` (
  `id` text PRIMARY KEY NOT NULL,
  `chat_id` text,
  `role` text,
  `content` text
);