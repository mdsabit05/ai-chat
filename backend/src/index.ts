
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getDB } from "./db";
import { chats } from "./db/schema";
import { v4 as uuidv4 } from "uuid";
import { messages } from "./db/schema";
import { eq } from "drizzle-orm";


type Bindings = {
  OPENROUTER_API_KEY: string;
  DB: D1Database;
};



const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({
  origin: 'http://localhost:5173',
  credentials: true
}))

app.get("/", (c) => {
  return c.json({ message: "Backend running" });
});

app.get("/chats", async (c) => {
  const db = getDB(c.env);
  const allChats = await db.select().from(chats);
  return c.json(allChats);
}); 
app.post("/chats", async (c) => {
  const db = getDB(c.env);

  const body = await c.req.json().catch(() => ({}));
  const title = (body?.title ?? "New Chat").toString();

  const id = uuidv4();

  await db.insert(chats).values({
    id,
    title,
  });

  return c.json({ id, title });
});

app.post("/messages", async (c) => {
 try {
   const db = getDB(c.env);

  const body = await c.req.json().catch(() => ({}));
  const chatId = body.chatId;
  const content = body.content;

  if (!chatId || !content) {
    return c.json({ error: "Missing fields" }, 400);
  }


  const userMsg = {
    id: uuidv4(),
    chatId,
    role: "user",
    content,
  };

  await db.insert(messages).values(userMsg);

console.log("ENV KEY:", c.env.OPENROUTER_API_KEY);


const headers = {
  Authorization: `Bearer ${c.env.OPENROUTER_API_KEY}`,
  "Content-Type": "application/json",
  "HTTP-Referer": "http://localhost:5173",
  "X-Title": "AI Chat App",
};

const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers,
  body: JSON.stringify({
   model: "openai/gpt-3.5-turbo",
    messages: [
      { role: "user", content }
    ],
  }),
});

if (!aiRes.ok) {
  const err = await aiRes.text();
  console.log("AI ERROR FULL:", err);

  return c.json({
    error: "AI failed",
    details: err,
  }, 500);
}


  const aiData:any  = await aiRes.json();
  

 if (!aiData?.choices?.length) {
  console.log("BAD AI DATA:", aiData);
  throw new Error("Invalid AI response");
}

const aiText = aiData.choices[0].message.content;


  const aiMsg = {
    id: uuidv4(),
    chatId,
    role: "assistant",
    content: aiText,
  };

  await db.insert(messages).values(aiMsg);
  console.log("KEY:", c.env.OPENROUTER_API_KEY);
  console.log("STATUS:", aiRes.status);
  return c.json({
    user: userMsg,
    ai: aiMsg,
  });
 }  catch (err) {
    console.error("SERVER ERROR:", err);
    return c.json({ error: "Internal error" }, 500);
  }
});


app.get("/messages/:chatId", async (c) => {
  const db = getDB(c.env);
  const chatId = c.req.param("chatId");

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId));

  return c.json(rows);
});

app.delete("/chats/:id", async (c) => {
  const db = getDB(c.env);
  const id = c.req.param("id");
  await db.delete(messages).where(eq(messages.chatId, id));
  await db.delete(chats).where(eq(chats.id, id));

  return c.json({ success: true });
});

export default app;

