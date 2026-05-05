import "./Navbar.css";

type Props = {
  onLogout: () => void;
};

export default function Navbar({ onLogout }: Props) {
  return (
    <div className="top-navbar">
      <h1 className="logo">AI Chat</h1>
      <div className="nav-actions">
        <button className="btn primary" onClick={onLogout}>Logout</button>
        <button className="btn outline">Settings</button>
      </div>
    </div>
  );
}