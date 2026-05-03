import { deleteChat } from "../lib/api";
import * as React from "react";
import "./Sidebar.css"

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
  onSelectChat: (id: string | null) => void;
  onNewChat: () => void;
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
};

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  setChats,
}: Props) {
  const handleDelete = async (id: string) => {
    try {
      await deleteChat(id);

      setChats((prev) => {
        const updated = prev.filter((c) => c.id !== id);

        if (updated.length > 0) {
          onSelectChat(updated[0].id);
        } else {
          onSelectChat(null);
        }

        return updated;
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="sidebar">
    <button className="new-chat" onClick={onNewChat}>
  + New Chat
</button>

      {chats.map((chat) => (
       <div
  key={chat.id}
  className={`chat-item ${
    chat.id === activeChatId ? "active" : ""
  }`}
>
  <span
    className="chat-title"
    onClick={() => onSelectChat(chat.id)}
  >
    {chat.title}
  </span>

  <button
    className="delete-btn"
    onClick={(e) => {
      e.stopPropagation();
      handleDelete(chat.id);
    }}
  >
    ✕
  </button>
</div>
      ))}
    </div>
  );
}