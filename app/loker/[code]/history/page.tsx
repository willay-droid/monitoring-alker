import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type PageProps = {
  params: { code: string };
  searchParams?: { nik?: string };
};

type LockerRow = {
  id: string;
  code: string;
  name: string | null;
  location: string | null;
  status: string | null;
  status_updated_at: string | null;
  code_norm: string | null;
};

type LockerHistoryRow = {
  session_id: string | number;
  session_type: string; // "CHECKOUT" | "CHECKIN" dst
  nik_actor: string | null;
  event_at: string | null;

  pair_checkout_id: string | number | null;
  checkout_nik: string | null;
  checkout_at: string | null;

  duration: string | null;
  is_open_checkout: boolean | null;
};

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function fmt(dt: string | null) {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("id-ID", { hour12: false });
}

// "LOKER-01" -> { code: "LOKER-001", code_norm: "001" }
function normalizeLockerCode(input: string) {
  const s = input.trim().toUpperCase();
  const m = s.match(/(\d+)/);
  if (!m) return { code: s, code_norm: null as string | null };

  const padded = m[1].padStart(3, "0");
  return {
    code: s.includes("LOKER-") ? `LOKER-${padded}` : s,
    code_norm: padded,
  };
}

export default async function LockerHistoryPage(props: PageProps) {
  const supabase = getSupabaseServer();

  const { code } = props.params;
  const sp = props.searchParams ?? {};
  const nikFilter = (sp.nik ?? "").trim();

  const rawCode = decodeURIComponent(code);
  const norm = normalizeLockerCode(rawCode);

  // 1) Cari locker (code / normalized / code_norm)
  const { data: lockerData, error: lockerErr } = await supabase
    .from("lockers")
    .select("id, code, name, location, status, status_updated_at, code_norm")
    .or(`code.eq.${rawCode},code.eq.${norm.code},code_norm.eq.${norm.code_norm ?? ""}`)
    .limit(1)
    .maybeSingle();

  const locker = lockerData as LockerRow | null;

  if (lockerErr || !locker) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>Locker tidak ditemukan</h1>
        <p>
          Code URL: <b>{rawCode}</b>
        </p>
        <p>
          Normalized: <b>{norm.code}</b> / <b>{norm.code_norm ?? "-"}</b>
        </p>
        <div style={{ marginTop: 10 }}>
          <Link href="/">Kembali</Link>
        </div>
        {lockerErr ? (
          <div style={{ marginTop: 10, color: "tomato" }}>Error: {lockerErr.message}</div>
        ) : null}
      </div>
    );
  }

  // 2) Ambil history dari view
  let q = supabase
    .from("locker_history_view")
    .select(
      [
        "session_id",
        "session_type",
        "nik_actor",
        "event_at",
        "pair_checkout_id",
        "checkout_nik",
        "checkout_at",
        "duration",
        "is_open_checkout",
      ].join(",")
    )
    .eq("locker_id", locker.id)
    .order("event_at", { ascending: false })
    .limit(200);

  if (nikFilter) {
    q = q.or(`nik_actor.ilike.%${nikFilter}%,checkout_nik.ilike.%${nikFilter}%`);
  }

  const { data: historyData, error: histErr } = await q;

  // ✅ KUNCI: pastiin history itu array of row (bukan type error)
  const history: LockerHistoryRow[] = (historyData ?? []) as unknown as LockerHistoryRow[];

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "system-ui",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>
            History {locker.code} — {locker.name ?? "-"}
          </h1>
          <div style={{ opacity: 0.8, marginTop: 6 }}>{locker.location ?? "-"}</div>
          <div style={{ marginTop: 10 }}>
            <Link href={`/loker/${encodeURIComponent(rawCode)}`}>
              ← Kembali ke halaman teknisi
            </Link>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              display: "inline-block",
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid #333",
              fontWeight: 800,
            }}
          >
            {locker.status ?? "-"}
          </div>
          <div style={{ opacity: 0.7, marginTop: 6, fontSize: 12 }}>
            updated: {fmt(locker.status_updated_at)}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <form style={{ display: "flex", gap: 8 }}>
          <input
            name="nik"
            defaultValue={nikFilter}
            placeholder="Filter NIK..."
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "transparent",
              minWidth: 220,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "transparent",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Search
          </button>
          <Link
            href={`/loker/${encodeURIComponent(rawCode)}/history`}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #333",
              textDecoration: "none",
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Reset
          </Link>
        </form>

        <div style={{ marginLeft: "auto", opacity: 0.7, fontSize: 12 }}>
          Menampilkan max 200 baris terbaru
        </div>
      </div>

      {histErr ? (
        <div style={{ marginTop: 12, color: "tomato" }}>
          Error load history: {histErr.message}
        </div>
      ) : null}

      {/* Table */}
      <div
        style={{
          marginTop: 14,
          overflowX: "auto",
          border: "1px solid #222",
          borderRadius: 12,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #222" }}>
              <th style={{ padding: 12 }}>Waktu</th>
              <th style={{ padding: 12 }}>Event</th>
              <th style={{ padding: 12 }}>NIK</th>
              <th style={{ padding: 12 }}>Pair</th>
              <th style={{ padding: 12 }}>Durasi</th>
              <th style={{ padding: 12 }}>Open?</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r, idx) => (
              <tr
                key={String(r.session_id ?? `${r.event_at ?? "x"}-${idx}`)}
                style={{ borderBottom: "1px solid #1a1a1a" }}
              >
                <td style={{ padding: 12, whiteSpace: "nowrap" }}>{fmt(r.event_at)}</td>
                <td style={{ padding: 12, fontWeight: 900 }}>{r.session_type}</td>
                <td style={{ padding: 12 }}>{r.nik_actor ?? "-"}</td>

                <td style={{ padding: 12 }}>
                  {r.session_type === "CHECKIN" ? (
                    <div style={{ fontSize: 13, lineHeight: 1.35 }}>
                      <div>
                        <b>checkout_id:</b> {r.pair_checkout_id ?? "-"}
                      </div>
                      <div>
                        <b>checkout_nik:</b> {r.checkout_nik ?? "-"}
                      </div>
                      <div>
                        <b>checkout_at:</b> {fmt(r.checkout_at)}
                      </div>
                    </div>
                  ) : (
                    "-"
                  )}
                </td>

                <td style={{ padding: 12 }}>
                  {r.session_type === "CHECKIN" ? (r.duration ?? "-") : "-"}
                </td>

                <td style={{ padding: 12 }}>
                  {r.session_type === "CHECKOUT"
                    ? r.is_open_checkout
                      ? "✅ OPEN"
                      : "—"
                    : "—"}
                </td>
              </tr>
            ))}

            {history.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, opacity: 0.8 }}>
                  Tidak ada history (atau filter NIK tidak cocok).
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
