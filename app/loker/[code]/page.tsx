export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import LockerActions from "./LockerActions";
import { createClient } from "@/lib/supabase/server";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateTimeID(dtStr: string) {
  const d = new Date(dtStr);
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = String(d.getFullYear()).slice(-2);
  const HH = pad2(d.getHours());
  const MM = pad2(d.getMinutes());
  const SS = pad2(d.getSeconds());
  return `${dd}/${mm}/${yy}, ${HH}.${MM}.${SS}`;
}

// DB lu: lockers.code_norm = "001"
function toCodeNormFromUrl(code: string) {
  const digits = (code.match(/\d+/g) || []).join("");
  const last3 = digits.slice(-3);
  return last3.padStart(3, "0");
}

type PageProps = {
  params: Promise<{ code: string }>;
};

type LockerRow = {
  id: number;
  code: string;
  code_norm?: string | null;
  name: string | null;
  location: string | null;
  status: string | null; // AVAILABLE | IN_USE
  holder_nik: string | null;
  status_updated_at: string | null;
  is_active: boolean | null;
};

type LockerEventRow = {
  id: string;
  locker_id: number;
  nik: string;
  action: string; // CHECKOUT | CHECKIN
  created_at: string;
  note?: string | null;
};

export type ToolRowLite = {
  id: number;
  name: string | null;
  category: string | null;
  status: string | null; // AVAILABLE | DAMAGED
  is_active: boolean | null;
};

function StatusPill({ status }: { status: string }) {
  const s = (status ?? "AVAILABLE").toUpperCase();
  const isAvail = s === "AVAILABLE";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        isAvail ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700",
      ].join(" ")}
    >
      {s}
    </span>
  );
}

export default async function LockerPage({ params }: PageProps) {
  const { code } = await params;
  const supabase = await createClient();

  const codeParam = String(code ?? "").trim();
  if (!codeParam) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-2xl border p-5">Kode locker tidak valid.</div>
      </div>
    );
  }

  const codeNorm = toCodeNormFromUrl(codeParam);

  // prefer by code_norm (karena DB lu simpan "001")
  const q1 = await supabase
    .from("lockers")
    .select("id, code, name, location, status, holder_nik, status_updated_at, is_active, code_norm")
    .eq("code_norm", codeNorm)
    .maybeSingle();

  if (q1.error) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-2xl border p-5">Error DB: {q1.error.message}</div>
      </div>
    );
  }

  // fallback exact code
  let locker: LockerRow | null = (q1.data as any) ?? null;

  if (!locker) {
    const q2 = await supabase
      .from("lockers")
      .select("id, code, name, location, status, holder_nik, status_updated_at, is_active, code_norm")
      .eq("code", codeParam)
      .maybeSingle();

    if (q2.error) {
      return (
        <div className="mx-auto max-w-5xl p-6">
          <div className="rounded-2xl border p-5">Error DB: {q2.error.message}</div>
        </div>
      );
    }

    locker = (q2.data as any) ?? null;
  }

  if (!locker) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-2xl border p-5">Locker tidak ditemukan.</div>
      </div>
    );
  }

  if (locker.is_active === false) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-2xl border p-5">Locker nonaktif.</div>
      </div>
    );
  }

  const status = ((locker.status ?? "AVAILABLE").toUpperCase() as "AVAILABLE" | "IN_USE") || "AVAILABLE";

  // === tools list (buat checklist rusak saat checkin)
  const { data: toolsRaw, error: toolsErr } = await supabase
    .from("tools")
    .select("id, name, category, status, is_active")
    .eq("locker_id", locker.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (toolsErr) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-2xl border p-5">Error load tools: {toolsErr.message}</div>
      </div>
    );
  }

  const tools: ToolRowLite[] = (toolsRaw ?? []) as any;

  const { data: eventsRaw, error: evErr } = await supabase
    .from("locker_events")
    .select("id, locker_id, nik, action, created_at, note")
    .eq("locker_id", locker.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (evErr) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-2xl border p-5">Error history: {evErr.message}</div>
      </div>
    );
  }

  const events: LockerEventRow[] = (eventsRaw ?? []) as any;

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      {/* HEADER */}
      <div className="rounded-2xl border p-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm text-gray-500">
              {locker.code} — {locker.name ?? "-"}
            </div>
            <div className="text-base font-semibold">{locker.location ?? "-"}</div>

            <div className="mt-3 flex items-center gap-2 text-sm">
              <span>Status:</span>
              <StatusPill status={status} />
            </div>

            <div className="mt-2 text-xs text-gray-500">
              Status updated: {locker.status_updated_at ? new Date(locker.status_updated_at).toLocaleString() : "-"}
            </div>
          </div>

          <div className="text-right text-sm">
            <div className="font-semibold">Pemegang Saat Ini</div>
            {status === "IN_USE" ? (
              <div className="mt-1">
                NIK: <b>{locker.holder_nik ?? "-"}</b>
              </div>
            ) : (
              <div className="mt-1 text-gray-600">Tidak ada. Locker AVAILABLE.</div>
            )}
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="rounded-2xl border p-5">
        <div className="mb-3 font-semibold">Aksi Teknisi</div>
        <LockerActions code={locker.code} status={status} tools={tools} />
      </div>

      {/* HISTORY */}
      <div className="rounded-2xl border">
        <div className="border-b px-5 py-4">
          <div className="text-sm font-semibold">History</div>
          <div className="mt-1 text-xs text-gray-500">Menampilkan 20 transaksi terakhir.</div>
        </div>

        <div className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-500">
                <tr className="border-b">
                  <th className="py-3 pr-4">Waktu</th>
                  <th className="py-3 pr-4">NIK</th>
                  <th className="py-3 pr-4">Aksi</th>
                  <th className="py-3 pr-4">Note</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td className="py-4 text-gray-600" colSpan={4}>
                      Belum ada history.
                    </td>
                  </tr>
                ) : (
                  events.map((e) => (
                    <tr key={e.id} className="border-b last:border-b-0">
                      <td className="py-4 pr-4 whitespace-nowrap">{formatDateTimeID(e.created_at)}</td>
                      <td className="py-4 pr-4">{e.nik}</td>
                      <td className="py-4 pr-4">{(e.action ?? "").toUpperCase()}</td>
                      <td className="py-4 pr-4">{e.note ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-gray-500">Tips: status akan selalu mengikuti DB (no cache).</div>
        </div>
      </div>
    </div>
  );
}
