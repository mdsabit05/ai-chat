// src/components/Navbar.tsx
import "./Navbar.css";

export default function Navbar() {
  return (
    <div className="top-navbar">
      <h1 className="logo">AI Chat Dashboard</h1>

      <div className="nav-actions">
        <button className="btn primary">Logout</button>
        <button className="btn outline">Settings</button>
      </div>
    </div>
  );
}