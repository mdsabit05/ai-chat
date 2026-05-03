import { useEffect, useState } from "react";
import "./Home.css";
import { sendMessage, getMessages } from "../lib/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
};

type Props = {
  chats: Chat[];
  activeChatId: string | null;
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
};

export default function Home({ chats, activeChatId, setChats }: Props) {
  const [input, setInput] = useState("");

  const activeChat =
  chats.find((c) => c.id === activeChatId) || {
    id: "",
    title: "",
    messages: [],
  };

  useEffect(() => {
  if (!activeChatId) return;

  getMessages(activeChatId).then((msgs) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? { ...chat, messages: msgs }
          : chat
      )
    );
  });
}, [activeChatId]);


const handleSend = async () => {
  if (!input.trim() || !activeChatId) return;

  const text = input;
  setInput("");

  // Optimistic UI (show user msg instantly)
  const tempMsg: Message = {
    id: crypto.randomUUID(),
    role: "user",
    content: text,
  };

  setChats((prev) =>
    prev.map((chat) =>
      chat.id === activeChatId
        ? { ...chat,messages: [...(chat.messages || []), tempMsg]}
        : chat
    )
  );

  try {
    const res = await sendMessage(activeChatId, text);

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
             messages: [...(chat.messages || []), res.ai]
            }
          : chat
      )
    );
  } catch (err) {
    console.error(err);
  }
};


  return (
    <div className="chat-container">
      <h2 className="welcome">Welcome, sabit</h2>

      {!activeChat || activeChat.messages.length === 0 ? (
        <div className="empty-state">
          <h1>Start a new conversation</h1>
          <p>Ask anything, explore ideas, or get help instantly.</p>
        </div>
      ) : (
        <div className="chat-box">
          {activeChat.messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-row ${
                msg.role === "user" ? "right" : "left"
              }`}
            >
              <div className={`msg ${msg.role === "user" ? "user" : "ai"}`}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="input-bar">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask anything..."
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}