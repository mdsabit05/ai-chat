import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import "./App.css";
import { createChat } from "./lib/api";

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

function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // ✅ LOAD CHATS FROM BACKEND
  useEffect(() => {
    fetch("http://127.0.0.1:8787/chats")
      .then((res) => res.json())
  .then((data) => {
  const formatted = data.map((chat: any) => ({
    ...chat,
    messages: [],
  }));

  setChats(formatted);
  if (formatted.length > 0) {
    setActiveChatId(formatted[0].id);
  }
})
      .catch(console.error);
  }, []);



const handleNewChat = async () => {
  const data = await createChat();

  const newChat: Chat = {
    id: data.id,
    title: data.title,
    messages: [],
  };

  setChats((prev) => [newChat, ...prev]);
  setActiveChatId(newChat.id);
};

  return (
    <div className="div1">
    <Sidebar
  chats={chats}
  activeChatId={activeChatId}
  onSelectChat={setActiveChatId}
  onNewChat={handleNewChat}
  setChats={setChats}   // ✅ ADD THIS
/>

      <div className="div2">
        <Navbar />

        <div className="div3">
          <Home
            chats={chats}
            activeChatId={activeChatId}
            setChats={setChats}
          />
        </div>
      </div>
    </div>
  );
}

export default App;