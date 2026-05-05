// const BASE_URL = "http://127.0.0.1:8787";
const BASE_URL = "https://backend.mdsabitrazabarkati.workers.dev";

export const api = async (
  path: string,
  options: RequestInit = {}
) => {
  const token = localStorage.getItem("token");

  const res = await fetch(BASE_URL + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && {
        Authorization: `Bearer ${token}`,
      }),
      ...(options.headers || {}),
    },
  });

  return res.json();
};
export const signup = async (data: {
  email: string;
  password: string;
  name: string;
}) => {
  const res = await api("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (res.token) {
    localStorage.setItem("token", res.token);
    localStorage.setItem("userName", data.name); // 👈 save name
  }

  return res;
};

export const login = async (data: {
  email: string;
  password: string;
}) => {
  const res = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (res.token) {
    localStorage.setItem("token", res.token);
    localStorage.setItem("userName", data.email.split("@")[0]); // 👈 use email prefix as fallback
  }

  return res;
};
export const getChats = () => {
  return api("/chats");
};
export const deleteChat = (chatId: string) => {
  return api(`/chats/${chatId}`, {
    method: "DELETE",
  });
};

export const createChat = async () => {
  return api("/chats", { method: "POST" });
};

export const getMessages = (chatId: string) => {
  return api(`/messages/${chatId}`);
};

export const sendMessage = async (
  chatId: string,
  content: string,
  onToken: (token: string) => void
): Promise<void> => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ chatId, content }),
  });

  const data = await res.json() as any;
  if (data.message) {
    onToken(data.message); // send full message at once
  }
};
export const getCurrentUser = (): { userId: string } | null => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload;
  } catch {
    return null;
  }
};


export const updateChatTitle = (chatId: string, title: string) => {
  return api(`/chats/${chatId}/title`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
};