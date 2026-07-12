import { NavLink, Outlet } from "react-router-dom";
import { getAdminKey, setAdminKey } from "../api";
import { useState } from "react";

export function Shell() {
  const [key, setKey] = useState(getAdminKey());
  return (
    <div className="shell">
      <aside className="side">
        <h1>HarvestHub Ops</h1>
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Dashboard
        </NavLink>
        <NavLink to="/kyc" className={({ isActive }) => (isActive ? "active" : "")}>
          KYC queue
        </NavLink>
        <NavLink to="/shops" className={({ isActive }) => (isActive ? "active" : "")}>
          Shops
        </NavLink>
        <div style={{ marginTop: "auto", paddingTop: 24 }}>
          <div style={{ fontSize: 11, color: "#8e8c86", marginBottom: 6 }}>ADMIN KEY</div>
          <input
            style={{ width: "100%", background: "#2a2a28", color: "#fff", border: "1px solid #3a3a38" }}
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setAdminKey(e.target.value);
            }}
            placeholder="X-Admin-Key"
          />
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
