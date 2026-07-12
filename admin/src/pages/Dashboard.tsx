import { useEffect, useState } from "react";
import { adminApi } from "../api";

export function Dashboard() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    adminApi<Record<string, number>>("/api/admin/stats")
      .then(setStats)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="err">{err} — set the admin key in the sidebar.</p>;
  if (!stats) return <p>Loading…</p>;

  const cards = [
    ["Users", stats.users],
    ["Shops", stats.shops],
    ["Live products", stats.products],
    ["Orders", stats.orders],
    ["Pending KYC", stats.pendingKyc],
  ];

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="cards">
        {cards.map(([l, n]) => (
          <div className="card" key={String(l)}>
            <div className="n">{n}</div>
            <div className="l">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
