"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Tool = {
  id: string;
  name: string;
  qr_code: string;
  category: string | null;
  status: "AVAILABLE" | "IN_USE" | "DAMAGED";
  current_holder_nik?: string | null;
  last_event_at?: string | null;
};

export default function ToolsDashboardPage() {
  const [status, setStatus] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [tools, setTools] = useState<Tool[]>([]);

  const queryUrl = useMemo(() => {
    const sp = new URLSearchParams();
    if (status !== "ALL") sp.set("status", status);
    if (q.trim()) sp.set("q", q.trim());
    return `/api/tools?${sp.toString()}`;
  }, [status, q]);

  useEffect(() => {
    setLoading(true);
    fetch(queryUrl)
      .then((r) => r.json())
      .then((j) => setTools(j.tools ?? []))
      .finally(() => setLoading(false));
  }, [queryUrl]);

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Daftar Alat</h1>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama / kode (contoh: CLEAVER)"
          style={{ flex: 1, minWidth: 240 }}
        />

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All</option>
          <option value="AVAILABLE">AVAILABLE</option>
          <option value="IN_USE">IN_USE</option>
          <option value="DAMAGED">DAMAGED</option>
        </select>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <table width="100%" cellPadding={10} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th>Nama</th>
              <th>Kode</th>
              <th>Kategori</th>
              <th>Status</th>
              <th>Pemegang</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tools.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td>{t.name}</td>
                <td>{t.qr_code}</td>
                <td>{t.category ?? "-"}</td>
                <td>
                  <strong>{t.status}</strong>
                </td>
                <td>{t.current_holder_nik ?? "-"}</td>
                <td style={{ textAlign: "right" }}>
                  <Link href={`/t/${t.qr_code}`}>Buka</Link>
                </td>
              </tr>
            ))}
            {tools.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 14, opacity: 0.7 }}>
                  Tidak ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </main>
  );
}
