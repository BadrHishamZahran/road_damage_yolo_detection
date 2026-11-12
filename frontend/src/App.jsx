import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Detection from "./pages/Detection.jsx";
import History from "./pages/History.jsx";
import Performance from "./pages/Performance.jsx";
import Settings from "./pages/Settings.jsx";

const Icon = ({ d }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const NAV = [
  { to: "/", label: "Dashboard", d: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" },
  { to: "/detection", label: "Detection", d: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" },
  { to: "/history", label: "Results History", d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2" },
  { to: "/performance", label: "Model Performance", d: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { to: "/settings", label: "Settings", d: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" },
];

export default function App() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M8 3 4 21M16 3l4 18M12 5v3M12 11v3M12 17v3" />
            </svg>
          </div>
          RoadVision AI
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
            <Icon d={n.d} />
            {n.label}
          </NavLink>
        ))}
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/detection" element={<Detection />} />
          <Route path="/history" element={<History />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
