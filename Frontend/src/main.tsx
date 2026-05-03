// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App"; // ✅ make sure this import exists
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);