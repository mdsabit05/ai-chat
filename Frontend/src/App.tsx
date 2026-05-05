import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import "./App.css";
import { createChat, getChats } from "./lib/api";

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
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
 const [userName, setUserName] = useState<string>(
    localStorage.getItem("userName") || "User"
  );
 useEffect(() => {
  if (!token) return;
  getChats().then(async (data) => {
    if (!Array.isArray(data)) return;
    const formatted = data.map((chat: any) => ({
      ...chat,
      messages: [],
    }));

    if (formatted.length === 0) {
      // auto-create first chat
      const newChat = await createChat();
      const first = { id: newChat.id, title: "New Chat", messages: [] };
      setChats([first]);
      setActiveChatId(first.id);
    } else {
      setChats(formatted);
      setActiveChatId(formatted[0].id);
    }
  });
}, [token]);

  const handleNewChat = async () => {
    const data = await createChat();
    const newChat: Chat = {
      id: data.id,
      title: "New Chat",
      messages: [],
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
     localStorage.removeItem("userName");
    setToken(null);
    setChats([]);
    setActiveChatId(null);
  };

    const handleLogin = (token: string) => {
    setToken(token);
    setUserName(localStorage.getItem("userName") || "User"); // 👈 read after login
  };

  // 👇 auth guard
   if (!token) {
    return <Login onLogin={handleLogin} />;
  }


  return (
    <div className="div1">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={handleNewChat}
        setChats={setChats}
      />
      <div className="div2">
        <Navbar onLogout={handleLogout} />
        <div className="div3">
          <Home
            chats={chats}
            activeChatId={activeChatId}
            setChats={setChats}
             userName={userName}
          />
        </div>
      </div>
    </div>
  );
}

export default App;