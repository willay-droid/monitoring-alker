export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

import AddToolPopover from "./AddToolPopover";
import ToolsTableClient, { type ToolRow } from "./ToolsTableClient";
import LockerHistoryClient, { type LockerHistoryRow } from "./LockerHistoryClient";

function toCodeNormFromUrl(code: string) {
  const digits = (code.match(/\d+/g) || []).join("");
  const last3 = digits.slice(-3);
  return last3.padStart(3, "0");
}

type LockerRow = {
  id: number;
  code: string;
  code_norm?: string | null;
  name: string | null;
  location: string | null;
  status?: string | null; // AVAILABLE | IN_USE
  holder_nik?: string | null;
  is_active?: boolean | null;
};

type ToolDbRow = {
  id: number;
  name: string | null;
  category: string | null;
  status: string | null; // AVAILABLE | DAMAGED
  is_active: boolean | null;
};

export default async function AdminLockerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const sp = (await searchParams) ?? {};

  const lockerCodeParam = decodeURIComponent(String(code ?? "")).trim();
  if (!lockerCodeParam) notFound();

  // query params (history pagination)
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const perPageRaw = Number(Array.isArray(sp.perPage) ? sp.perPage[0] : sp.perPage) || 50;
  const perPage: 50 | 100 = perPageRaw === 100 ? 100 : 50;

  const orderRaw = String(Array.isArray(sp.order) ? sp.order[0] : sp.order || "desc").toLowerCase();
  const order: "asc" | "desc" = orderRaw === "asc" ? "asc" : "desc";

  const sb = supabaseAdmin();

  // === locker info (prefer code_norm)
  const codeNorm = toCodeNormFromUrl(lockerCodeParam);

  const q1 = await sb
    .from("lockers")
    .select("id, code, code_norm, name, location, status, holder_nik, is_active")
    .eq("code_norm", codeNorm)
    .maybeSingle();

  if (q1.error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          Gagal load locker: {q1.error.message}
        </div>
      </div>
    );
  }

  let locker: LockerRow | null = (q1.data as any) ?? null;

  if (!locker) {
    const q2 = await sb
      .from("lockers")
      .select("id, code, code_norm, name, location, status, holder_nik, is_active")
      .eq("code", lockerCodeParam)
      .maybeSingle();

    if (q2.error) {
      return (
        <div className="p-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            Gagal load locker: {q2.error.message}
          </div>
        </div>
      );
    }

    locker = (q2.data as any) ?? null;
  }

  if (!locker) notFound();
  if (locker.is_active === false) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Locker <b>{lockerCodeParam}</b> nonaktif.
        </div>
      </div>
    );
  }

  const lockerData = locker;
  const lockerStatus = String(lockerData.status ?? "AVAILABLE").toUpperCase();
  const lockerInUse = lockerStatus === "IN_USE";

  // === tools in this locker (pakai tabel tools langsung biar sinkron sama actions.ts + is_active)
  const { data: toolsRaw, error: toolsErr } = await sb
    .from("tools")
    .select("id, name, category, status, is_active")
    .eq("locker_id", lockerData.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (toolsErr) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          Gagal load tools: {toolsErr.message}
        </div>
      </div>
    );
  }

  const toolRows = (toolsRaw ?? []) as ToolDbRow[];

  const total = toolRows.length;
  const available = toolRows.filter((r) => (r.status ?? "").toUpperCase() === "AVAILABLE").length;
  const damaged = toolRows.filter((r) => (r.status ?? "").toUpperCase() === "DAMAGED").length;

  const clientTools: ToolRow[] = toolRows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    status: r.status,
  }));

  // === HISTORY (ambil dari locker_events agar NOTE kebaca)
  let historyRows: LockerHistoryRow[] = [];
  let historyTotal = 0;

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data: historyData, error: hErr, count } = await sb
    .from("locker_events")
    .select("id, locker_id, nik, action, created_at, note", { count: "exact" })
    .eq("locker_id", lockerData.id)
    .order("created_at", { ascending: order === "asc" })
    .range(from, to);

  if (hErr) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          Gagal load history: {hErr.message}
        </div>
      </div>
    );
  }

  historyTotal = count ?? 0;
  historyRows = (historyData ?? []).map((r: any) => ({
    id: String(r.id),
    nik: r.nik ?? "-",
    action: String(r.action ?? "-").toUpperCase(),
    toolCount: 0, // kalau nanti ada event_items, baru kita isi beneran
    createdAt: r.created_at ?? "",
    note: r.note ?? null,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500">ADMIN / LOCKER</div>
            <h1 className="text-2xl font-semibold">{lockerData.code}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {lockerData.name ?? "-"} • {lockerData.location ?? "-"}
            </p>

            <div className="mt-2 text-sm">
              Status Locker:{" "}
              <span
                className={[
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                  lockerInUse
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700",
                ].join(" ")}
              >
                {lockerStatus}
              </span>
              {lockerInUse ? (
                <span className="ml-2 text-xs text-gray-600">
                  Holder: <b>{lockerData.holder_nik ?? "-"}</b>
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/admin/lockers" className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm">
              ← Kembali
            </Link>

            <AddToolPopover lockerCode={lockerData.code} />
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-gray-500">Total Tools</div>
            <div className="text-2xl font-semibold mt-1">{total}</div>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-gray-500">Available</div>
            <div className="text-2xl font-semibold mt-1 text-emerald-700">{available}</div>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-gray-500">Damaged</div>
            <div className="text-2xl font-semibold mt-1 text-red-700">{damaged}</div>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-gray-500">Locker In Use</div>
            <div className={`text-2xl font-semibold mt-1 ${lockerInUse ? "text-amber-800" : "text-gray-900"}`}>
              {lockerInUse ? "YA" : "TIDAK"}
            </div>
          </div>
        </div>

        {/* Tools Table */}
        <div className="rounded-2xl border bg-white overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Daftar Alat</div>
              <div className="text-xs text-gray-500">Ini isi tools di {lockerData.code}.</div>
            </div>
            <div className="text-xs text-gray-500">{total} item</div>
          </div>

          <ToolsTableClient lockerCode={lockerData.code} tools={clientTools} />
        </div>

        {/* History Locker */}
        <LockerHistoryClient
          lockerCode={lockerData.code}
          rows={historyRows}
          total={historyTotal}
          page={page}
          perPage={perPage}
          order={order}
        />
      </div>
    </div>
  );
}
