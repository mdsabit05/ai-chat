import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
    createdAt: integer("created_at"),
  updatedAt: integer("updated_at"),
});

export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  title: text("title"),
  userId: text("user_id").notNull(), // 👈 ADD THIS
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id"),
  role: text("role"),
  content: text("content"),
});