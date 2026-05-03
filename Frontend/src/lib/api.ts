const BASE = "http://127.0.0.1:8787";

export async function createChat(title?: string) {
  const res = await fetch(`${BASE}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("createChat failed");
  return res.json(); // { id, title }
}

export async function sendMessage(chatId: string, content: string) {
  const res = await fetch(`${BASE}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, content }),
  });
  if (!res.ok) throw new Error("sendMessage failed");
  return res.json(); // { user, ai }
}

export async function getMessages(chatId: string) {
  const res = await fetch(`${BASE}/messages/${chatId}`);
  if (!res.ok) throw new Error("getMessages failed");
  return res.json(); // Message[]
}

export async function deleteChat(chatId: string) {
  const res = await fetch(`${BASE}/chats/${chatId}`, {
    method: "DELETE",
  });

  if (!res.ok) throw new Error("deleteChat failed");
}