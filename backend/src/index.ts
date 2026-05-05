import { Hono } from "hono";
import { cors } from "hono/cors";
import { chats } from "./db/schema";
import { v4 as uuidv4 } from "uuid";
import { messages } from "./db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, generateToken, verifyToken } from "./utils/auth";
import { user } from "./db/schema";
import type { Context, Next } from "hono";
import { getDB } from "./db/index";

export type Bindings = {
  OPENROUTER_API_KEY: string;
  ai_chat_db: D1Database;
  BETTER_AUTH_SECRET: string;
};

const app = new Hono<{
  Bindings: Bindings;
  Variables: {
    userId: string;
  };
}>();

app.use("*", cors({
  origin: (origin) => {
    const allowed = [
      "http://localhost:5173",
      "https://ai-chat-frontend-3op.pages.dev",
    ];
    if (!origin || allowed.includes(origin) || origin.endsWith(".ai-chat-frontend-3op.pages.dev")) {
      return origin;
    }
    return null;
  },
  credentials: true,
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS", "PATCH"]
}));

app.get("/", (c) => {
  return c.json({ message: "Backend running" });
});

// middleware
const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "No token" }, 401);

  try {
    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token, c.env.BETTER_AUTH_SECRET);
    c.set("userId", payload.userId);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
};

// get chats
app.get("/chats", authMiddleware, async (c) => {
  const db = getDB(c);
  const userId = c.get("userId");
  const result = await db.select().from(chats).where(eq(chats.userId, userId));
  return c.json(result);
});

// create chat
app.post("/chats", authMiddleware, async (c) => {
  const db = getDB(c);
  const userId = c.get("userId");
  const id = uuidv4();
  await db.insert(chats).values({ id, title: "New Chat", userId });
  return c.json({ id });
});

// get messages
app.get("/messages/:chatId", authMiddleware, async (c) => {
  const db = getDB(c);
  const userId = c.get("userId");
  const chatId = c.req.param("chatId");

  const chat = await db.select().from(chats).where(eq(chats.id, chatId));
  if (!chat[0]) return c.json({ error: "Not found" }, 404);
  if (chat[0].userId !== userId) return c.json({ error: "Unauthorized" }, 403);

  const rows = await db.select().from(messages).where(eq(messages.chatId, chatId));
  return c.json(rows);
});

// post message
app.post("/messages", authMiddleware, async (c) => {
  const db = getDB(c);
  const userId = c.get("userId");
  const { chatId, content } = await c.req.json();

  const chat = await db.select().from(chats).where(eq(chats.id, chatId));
  if (!chat[0]) return c.json({ error: "Not found" }, 404);
  if (chat[0].userId !== userId) return c.json({ error: "Unauthorized" }, 403);

  await db.insert(messages).values({
    id: uuidv4(),
    chatId,
    content,
    role: "user",
  });

  return c.json({ success: true });
});

// delete chat
app.delete("/chats/:id", authMiddleware, async (c) => {
  const db = getDB(c);
  const userId = c.get("userId");
  const id = c.req.param("id");

  if (!id) return c.json({ error: "Missing id" }, 400);

  const chat = await db.select().from(chats).where(eq(chats.id, id));
  if (!chat[0]) return c.json({ error: "Not found" }, 404);
  if (chat[0].userId !== userId) return c.json({ error: "Unauthorized" }, 403);

  await db.delete(messages).where(eq(messages.chatId, id));
  await db.delete(chats).where(eq(chats.id, id));

  return c.json({ success: true });
});

// update chat title
app.patch("/chats/:id/title", authMiddleware, async (c) => {
  const db = getDB(c);
  const userId = c.get("userId");
  const id = c.req.param("id");
  const { title } = await c.req.json();

  if (!title) return c.json({ error: "Missing title" }, 400);

  const chat = await db.select().from(chats).where(eq(chats.id, id));
  if (!chat[0]) return c.json({ error: "Not found" }, 404);
  if (chat[0].userId !== userId) return c.json({ error: "Unauthorized" }, 403);

  await db.update(chats).set({ title }).where(eq(chats.id, id));
  return c.json({ success: true });
});

// signup
app.post("/api/auth/signup", async (c) => {
  const db = getDB(c);
  const { email, password, name } = await c.req.json();

  if (!email || !password) return c.json({ error: "Missing fields" }, 400);

  const hashed = await hashPassword(password);
  const id = uuidv4();

  try {
    await db.insert(user).values({
      id,
      email,
      password: hashed,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const token = await generateToken(id, c.env.BETTER_AUTH_SECRET);
    return c.json({ token });
  } catch (err) {
    return c.json({ error: "User exists or DB error" }, 400);
  }
});

// login
app.post("/api/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const email = body.email;
    const password = body.password;

    if (!email || !password) return c.json({ error: "Missing fields" }, 400);

    const db = getDB(c);
    const result = await db.select().from(user).where(eq(user.email, email));
    const existingUser = result[0];

    if (!existingUser) return c.json({ error: "User not found" }, 400);

    const isMatch = await comparePassword(password, existingUser.password);
    if (!isMatch) return c.json({ error: "Invalid password" }, 400);

    const token = await generateToken(existingUser.id, c.env.BETTER_AUTH_SECRET);
    return c.json({ token });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return c.json({ error: "Server error" }, 500);
  }
});

// protected test route
app.get("/api/protected", authMiddleware, async (c) => {
  const userId = c.get("userId");
  return c.json({ message: "Authorized", userId });
});

// AI chat route
app.post("/api/chat", authMiddleware, async (c) => {
  const db = getDB(c);
  const userId = c.get("userId");
  const { chatId, content } = await c.req.json();

  if (!chatId || !content) return c.json({ error: "Missing chatId or content" }, 400);

  const chat = await db.select().from(chats).where(eq(chats.id, chatId));
  if (!chat[0]) return c.json({ error: "Not found" }, 404);
  if (chat[0].userId !== userId) return c.json({ error: "Unauthorized" }, 403);

  // save user message
  await db.insert(messages).values({
    id: uuidv4(),
    chatId,
    content,
    role: "user",
  });

  // get chat history
  const history = await db.select().from(messages).where(eq(messages.chatId, chatId));

  const formattedHistory = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content ?? "",
  }));

  // call OpenRouter
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${c.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-opus-4.7",
      messages: formattedHistory,
      max_tokens: 1000,
      stream: false,
    }),
  });

  const data = await response.json() as any;

  if (!response.ok) {
    console.error("OpenRouter error:", JSON.stringify(data));
    return c.json({ error: "AI error" }, 500);
  }

  const aiContent = data.choices?.[0]?.message?.content ?? "";

  // save AI response
  await db.insert(messages).values({
    id: uuidv4(),
    chatId,
    content: aiContent,
    role: "assistant",
  });

  // update title from first message
  if (history.length === 1) {
    const title = content.slice(0, 40) + (content.length > 40 ? "..." : "");
    await db.update(chats).set({ title }).where(eq(chats.id, chatId));
  }

  return c.json({ message: aiContent });
});

export default app;