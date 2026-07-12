import { useEffect, useState } from "react";
import { adminApi } from "../api";

type Row = {
  id: number;
  docType: string;
  docNumber: string;
  status: string;
  shopName: string;
  shopCity: string | null;
  createdAt: string;
};

export function KycPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const data = await adminApi<{ submissions: Row[] }>("/api/admin/kyc?status=pending");
      setRows(data.submissions);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function approve(id: number) {
    await adminApi(`/api/admin/kyc/${id}/approve`, { method: "POST", body: "{}" });
    await load();
  }

  async function reject(id: number) {
    const reason = prompt("Reject reason?") || "Incomplete documents";
    await adminApi(`/api/admin/kyc/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    await load();
  }

  return (
    <div>
      <h2>KYC queue</h2>
      {err ? <p className="err">{err}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Shop</th>
            <th>Doc</th>
            <th>Number</th>
            <th>Submitted</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>No pending submissions</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.shopName}
                  <div style={{ color: "#8e8c86", fontSize: 12 }}>{r.shopCity}</div>
                </td>
                <td>{r.docType}</td>
                <td>{r.docNumber}</td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button className="accent" onClick={() => approve(r.id)}>
                    Approve
                  </button>
                  <button className="danger" onClick={() => reject(r.id)}>
                    Reject
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
