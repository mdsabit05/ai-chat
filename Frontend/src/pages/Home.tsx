import { useEffect, useRef, useState } from "react";
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
  userName: string;
};

export default function Home({ chats, activeChatId, setChats, userName }: Props) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find((c) => c.id === activeChatId) || {
    id: "",
    title: "",
    messages: [],
  };

  useEffect(() => {
    if (!activeChatId) return;
    getMessages(activeChatId).then((msgs) => {
      if (!Array.isArray(msgs)) return;
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId ? { ...chat, messages: msgs } : chat
        )
      );
    });
  }, [activeChatId]);

  // auto scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat.messages]);

  const handleSend = async () => {
    if (!input.trim() || !activeChatId || isLoading) return;

    const text = input;
    setInput("");
    setError(null);
    setIsLoading(true);

    // user message bubble
    const tempUserMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    // empty AI bubble (will fill with streamed tokens)
    const tempAiId = crypto.randomUUID();
    const tempAiMsg: Message = {
      id: tempAiId,
      role: "assistant",
      content: "",
    };

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? { ...chat, messages: [...chat.messages, tempUserMsg, tempAiMsg] }
          : chat
      )
    );

    // update sidebar title from first message
    const isFirstMessage = activeChat.messages.length === 0;
    if (isFirstMessage) {
      const newTitle = text.slice(0, 40) + (text.length > 40 ? "..." : "");
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId ? { ...chat, title: newTitle } : chat
        )
      );
    }

    try {
      await sendMessage(activeChatId, text, (token) => {
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === activeChatId
              ? {
                  ...chat,
                  messages: chat.messages.map((m) =>
                    m.id === tempAiId
                      ? { ...m, content: m.content + token }
                      : m
                  ),
                }
              : chat
          )
        );
      });
    } catch (err) {
      // remove the empty AI bubble and show error
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                messages: chat.messages.filter((m) => m.id !== tempAiId),
              }
            : chat
        )
      );
      setError("AI failed to respond. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <h2 className="welcome">Welcome, {userName} 👋</h2>

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
              className={`message-row ${msg.role === "user" ? "right" : "left"}`}
            >
              <div className={`msg ${msg.role === "user" ? "user" : "ai"}`}>
                {msg.content === "" && msg.role === "assistant" ? (
                  <span className="typing-indicator">
                    <span></span><span></span><span></span>
                  </span>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* error banner */}
      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button onClick={() => setError(null)}>✕</button>
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
          placeholder={isLoading ? "AI is thinking..." : "Ask anything..."}
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading}>
          {isLoading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}