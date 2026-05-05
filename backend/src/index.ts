
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
  ai_chat_db: D1Database; // ✅ match binding name
  BETTER_AUTH_SECRET: string;
};

const app = new Hono<{
  Bindings: Bindings;
  Variables: {
    userId: string;
  };
}>();


app.use("*", cors({
  origin: "http://localhost:5173",
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

app.get("/chats", authMiddleware, async (c) => {
  const db = getDB(c);
  const userId = c.get("userId");

  const result = await db
    .select()
    .from(chats)
    .where(eq(chats.userId, userId)); // 👈 SECURITY

  return c.json(result);
});
app.post("/chats", authMiddleware, async (c) => {
  const db = getDB(c);
  const userId = c.get("userId");

  const id = uuidv4();

  await db.insert(chats).values({
    id,
    title: "New Chat",
    userId,
  });

  return c.json({ id });
});
app.post("/api/chat", authMiddleware, async (c) => {
  const db = getDB(c);
  const userId = c.get("userId");
  const { chatId, content } = await c.req.json();

  if (!chatId || !content) {
    return c.json({ error: "Missing chatId or content" }, 400);
  }

  // verify chat ownership
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

  // update chat title from first message
const messageCount = await db
  .select()
  .from(messages)
  .where(eq(messages.chatId, chatId));

if (messageCount.length === 1) {
  // this is the first message — use it as title
  const title = content.slice(0, 40) + (content.length > 40 ? "..." : "");
  await db
    .update(chats)
    .set({ title })
    .where(eq(chats.id, chatId));
}

  // get chat history for context
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId));

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
     model: "openrouter/auto",
      messages: formattedHistory,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("OpenRouter error:", err);
    return c.json({ error: "AI error" }, 500);
  }

  // stream back to frontend
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let fullResponse = "";

  // process stream in background
  (async () => {
    const reader = response.body!.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.replace("data: ", "").trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              fullResponse += token;
              await writer.write(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
            }
          } catch {}
        }
      }

      // save AI response to DB after stream ends
      await db.insert(messages).values({
        id: uuidv4(),
        chatId,
        content: fullResponse,
        role: "assistant",
      });

    } finally {
      await writer.close();
    }
  })();
  

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "http://localhost:5173",
    },
  });
});

// GET — add auth + ownership check
app.get("/messages/:chatId", authMiddleware, async (c) => {
  const db = getDB(c);
  const userId = c.get("userId");
  const chatId = c.req.param("chatId");

  // verify the chat belongs to this user
  const chat = await db.select().from(chats).where(eq(chats.id, chatId));
  if (!chat[0]) return c.json({ error: "Not found" }, 404);
  if (chat[0].userId !== userId) return c.json({ error: "Unauthorized" }, 403);

  const rows = await db.select().from(messages).where(eq(messages.chatId, chatId));
  return c.json(rows);
});

// POST — add ownership check
app.post("/messages", authMiddleware, async (c) => {
  const db = getDB(c);
  const userId = c.get("userId");
  const { chatId, content } = await c.req.json();

  // verify the chat belongs to this user
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

app.delete("/chats/:id", authMiddleware, async (c) => {
  const db = getDB(c); 
  const userId = c.get("userId");

  const id = c.req.param("id");

if (!id) {
  return c.json({ error: "Missing id" }, 400);
}

  // 🔍 check chat exists
  const chat = await db
    .select()
    .from(chats)
    .where(eq(chats.id, id));

  if (!chat[0]) {
    return c.json({ error: "Not found" }, 404);
  }

  // 🔒 check ownership
  if (chat[0].userId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  // 🧹 delete messages first
  await db.delete(messages).where(eq(messages.chatId, id));

  // 🗑 delete chat
  await db.delete(chats).where(eq(chats.id, id));

  return c.json({ success: true });
});
// signUp 

app.post("/api/auth/signup", async (c) => {
  const db = getDB(c);

  const { email, password, name } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: "Missing fields" }, 400);
  }

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

console.log("BODY:", body); // debug

const email = body.email;
const password = body.password;

if (!email || !password) {
  return c.json({ error: "Missing fields" }, 400);
}

    console.log("LOGIN INPUT:", email, password);

   const db = getDB(c);

    const result = await db
      .select()
      .from(user)
      .where(eq(user.email, email));

    console.log("DB RESULT:", result); 

    const existingUser = result[0];

    if (!existingUser) {
      return c.json({ error: "User not found" }, 400);
    }

    console.log("USER FROM DB:", existingUser);

    const isMatch = await comparePassword(password, existingUser.password);

    console.log("PASSWORD MATCH:", isMatch);

    if (!isMatch) {
      return c.json({ error: "Invalid password" }, 400);
    }

   const token = await generateToken(existingUser.id, c.env.BETTER_AUTH_SECRET);

    return c.json({ token });

  } catch (err) {
    console.error("LOGIN ERROR:", err); // 👈 CRITICAL
    return c.json({ error: "Server error" }, 500);
  }
});

app.get("/api/protected", authMiddleware, async (c) => {
  const userId = c.get("userId");
  return c.json({ message: "Authorized", userId });
});

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

export default app;

