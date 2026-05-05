import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import type { Context } from "hono";

export const getDB = (c: Context) => {
  return drizzle(c.env.ai_chat_db, { schema });
};