import { useEffect, useState } from "react";
import { adminApi } from "../api";

type Shop = {
  id: number;
  name: string;
  city: string | null;
  phone: string;
  isVerified: number;
  productCount: number;
  ratingAvg: string;
  logoUrl: string | null;
};

export function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const data = await adminApi<{ shops: Shop[] }>("/api/admin/shops");
      setShops(data.shops);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(id: number, verified: boolean) {
    await adminApi(`/api/admin/shops/${id}/verify`, {
      method: "PATCH",
      body: JSON.stringify({ verified }),
    });
    await load();
  }

  return (
    <div>
      <h2>Shops</h2>
      {err ? <p className="err">{err}</p> : null}
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>City</th>
            <th>Phone</th>
            <th>Products</th>
            <th>Rating</th>
            <th>Verified</th>
          </tr>
        </thead>
        <tbody>
          {shops.map((s) => (
            <tr key={s.id}>
              <td>
                {s.logoUrl ? (
                  <img src={s.logoUrl} alt="" width={36} height={36} style={{ borderRadius: 8, objectFit: "cover" }} />
                ) : (
                  "—"
                )}
              </td>
              <td>{s.name}</td>
              <td>{s.city ?? "—"}</td>
              <td>{s.phone}</td>
              <td>{s.productCount}</td>
              <td>{s.ratingAvg}</td>
              <td>
                <span className={`badge ${s.isVerified ? "" : "off"}`}>
                  {s.isVerified ? "Verified" : "Unverified"}
                </span>{" "}
                <button className="ghost" onClick={() => toggle(s.id, !s.isVerified)}>
                  Toggle
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
