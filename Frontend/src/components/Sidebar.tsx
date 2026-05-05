import { deleteChat, updateChatTitle } from "../lib/api";
import * as React from "react";
import { useState } from "react";
import "./Sidebar.css";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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

  const handleEditStart = (chat: Chat) => {
    setEditingId(chat.id);
    setEditValue(chat.title);
  };

  const handleEditSave = async (id: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;

    try {
      await updateChatTitle(id, trimmed);
      setChats((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setEditingId(null);
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
          className={`chat-item ${chat.id === activeChatId ? "active" : ""}`}
        >
          {editingId === chat.id ? (
            // edit mode
           <input
  className="chat-edit-input"
  value={editValue}
  autoFocus
  onChange={(e) => setEditValue(e.target.value)}
  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleEditSave(chat.id);
    if (e.key === "Escape") setEditingId(null);
  }}
  onBlur={() => handleEditSave(chat.id)}
/>
          ) : (
            // normal mode
            <span
              className="chat-title"
              onClick={() => onSelectChat(chat.id)}
            >
              {chat.title}
            </span>
          )}

          <div className="chat-actions">
            {editingId !== chat.id && (
              <button
                className="edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditStart(chat);
                }}
              >
                ✎
              </button>
            )}
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
        </div>
      ))}
    </div>
  );
}