export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AdminPageHeader from "./AdminPageHeader";

type LockerRow = {
  id: number;
  code: string;
  name: string | null;
  location: string | null;
  status: string | null; // AVAILABLE | IN_USE
};

type ToolsDashRow = {
  id: number;
  name: string;
  category: string | null;
  status: string; // AVAILABLE | IN_USE | DAMAGED
  locker_code: string | null;
  locker_name: string | null;
  locker_location: string | null;
};

type LockerEventRow = {
  id: string;
  locker_id: number;
  nik: string;
  action: string; // CHECKOUT | CHECKIN
  created_at: string;
};

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

function pillClass(kind: "ok" | "warn" | "blue" | "red") {
  if (kind === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (kind === "warn") return "border-amber-200 bg-amber-50 text-amber-700";
  if (kind === "blue") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function StatusPill({ status }: { status: string }) {
  const s = (status ?? "AVAILABLE").toUpperCase();
  const isAvail = s === "AVAILABLE";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        pillClass(isAvail ? "ok" : "warn"),
      ].join(" ")}
    >
      {s}
    </span>
  );
}

function ActionPill({ action }: { action: string }) {
  const a = (action ?? "").toUpperCase();
  const kind = a === "CHECKOUT" ? "blue" : "ok";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        pillClass(kind),
      ].join(" ")}
    >
      {a}
    </span>
  );
}

type LockerStats = {
  total: number;
  available: number;
  inUse: number;
  damaged: number;
};

export default async function AdminPage() {
  const supabase = supabaseAdmin();

  // 1) Lockers (status sumber utama)
  const { data: lockersRaw, error: lockerErr } = await supabase
    .from("lockers")
    .select("id, code, name, location, status")
    .order("code", { ascending: true });

  if (lockerErr) throw new Error(lockerErr.message);

  const lockers: LockerRow[] = (lockersRaw ?? []) as any;

  const lockerById = new Map<number, LockerRow>();
  for (const l of lockers) lockerById.set(Number(l.id), l);

  // 2) tools_dashboard -> hitung stats per locker_code (untuk info jumlah alat)
  const { data: toolsDashRaw, error: dashErr } = await supabase
    .from("tools_dashboard")
    .select("id, name, category, status, locker_code, locker_name, locker_location");

  // Kalau view gak ada / error, page tetap hidup (stats jadi 0)
  const toolsDash: ToolsDashRow[] = dashErr ? [] : ((toolsDashRaw ?? []) as any);

  const statsByCode = new Map<string, LockerStats>();
  for (const t of toolsDash) {
    const code = t.locker_code ? String(t.locker_code) : null;
    if (!code) continue;

    if (!statsByCode.has(code)) {
      statsByCode.set(code, { total: 0, available: 0, inUse: 0, damaged: 0 });
    }
    const s = statsByCode.get(code)!;
    s.total += 1;

    const st = (t.status ?? "").toUpperCase();
    if (st === "AVAILABLE") s.available += 1;
    else if (st === "IN_USE") s.inUse += 1;
    else if (st === "DAMAGED") s.damaged += 1;
  }

  // 3) History hari ini (locker_events)
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const { data: eventsRaw, error: evErr } = await supabase
    .from("locker_events")
    .select("id, locker_id, nik, action, created_at")
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  if (evErr) throw new Error(evErr.message);

  const events: LockerEventRow[] = (eventsRaw ?? []) as any;

  const totalEventsToday = events.length;
  const totalCheckoutToday = events.filter((e) => (e.action ?? "").toUpperCase() === "CHECKOUT").length;
  const totalCheckinToday = events.filter((e) => (e.action ?? "").toUpperCase() === "CHECKIN").length;

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        subtitle="Monitoring rekap pemakaian alat kerja & locker."
      />

      {/* STAT CARDS */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border p-5">
          <div className="text-xs text-gray-500">Total Event (Hari ini)</div>
          <div className="mt-2 text-3xl font-semibold">{totalEventsToday}</div>
          <div className="mt-1 text-xs text-gray-500">Maks 50 data terakhir ditampilkan di tabel.</div>
        </div>

        <div className="rounded-2xl border p-5">
          <div className="text-xs text-gray-500">Checkout</div>
          <div className="mt-2 text-3xl font-semibold text-blue-700">{totalCheckoutToday}</div>
          <div className="mt-1 text-xs text-gray-500">Jumlah transaksi checkout hari ini.</div>
        </div>

        <div className="rounded-2xl border p-5">
          <div className="text-xs text-gray-500">Checkin</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-700">{totalCheckinToday}</div>
          <div className="mt-1 text-xs text-gray-500">Jumlah transaksi checkin hari ini.</div>
        </div>
      </div>

      {/* QUICK ACCESS */}
      <div className="mt-6 rounded-2xl border">
        <div className="border-b px-5 py-4">
          <div className="text-sm font-semibold">Akses Cepat Locker</div>
          <div className="mt-1 text-xs text-gray-500">
            Ringkasan jumlah alat per locker (total, available, dipakai, damaged).
            {dashErr ? <span className="ml-2 text-red-600">(tools_dashboard error: {dashErr.message})</span> : null}
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-4 md:grid-cols-3">
            {lockers.map((l) => {
              const stat = statsByCode.get(String(l.code)) ?? { total: 0, available: 0, inUse: 0, damaged: 0 };

              return (
                <Link
                  key={l.id}
                  href={`/admin/lockers/${l.code}`}
                  className="block rounded-2xl border p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{l.code}</div>
                      <div className="mt-1 text-xs text-gray-600">
                        {l.name ?? "-"}
                        {l.location ? ` • ${l.location}` : ""}
                      </div>
                    </div>

                    {/* status murni dari lockers.status (JANGAN auto-update di sini) */}
                    <StatusPill status={(l.status ?? "AVAILABLE").toUpperCase()} />
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-3">
                    <div className="rounded-xl border p-3">
                      <div className="text-[10px] text-gray-500">Total</div>
                      <div className="mt-1 text-lg font-semibold">{stat.total}</div>
                    </div>
                    <div className="rounded-xl border p-3">
                      <div className="text-[10px] text-gray-500">Available</div>
                      <div className="mt-1 text-lg font-semibold text-emerald-700">{stat.available}</div>
                    </div>
                    <div className="rounded-xl border p-3">
                      <div className="text-[10px] text-gray-500">Dipakai</div>
                      <div className="mt-1 text-lg font-semibold text-blue-700">{stat.inUse}</div>
                    </div>
                    <div className="rounded-xl border p-3">
                      <div className="text-[10px] text-gray-500">Damaged</div>
                      <div className="mt-1 text-lg font-semibold text-red-600">{stat.damaged}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* HISTORY TABLE */}
      <div className="mt-6 rounded-2xl border">
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <div>
            <div className="text-sm font-semibold">History Hari Ini</div>
            <div className="mt-1 text-xs text-gray-500">Menampilkan transaksi hari ini + nama locker. (Limit 50)</div>
          </div>

          <Link
            href="/admin/lockers"
            className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Lihat semua locker →
          </Link>
        </div>

        <div className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-500">
                <tr className="border-b">
                  <th className="py-3 pr-4">Waktu</th>
                  <th className="py-3 pr-4">Locker</th>
                  <th className="py-3 pr-4">NIK</th>
                  <th className="py-3 pr-4">Aksi</th>
                  <th className="py-3 pr-4">Jumlah Alat</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td className="py-4 text-gray-600" colSpan={5}>
                      Belum ada transaksi hari ini.
                    </td>
                  </tr>
                ) : (
                  events.map((e) => {
                    const locker = lockerById.get(Number(e.locker_id));
                    const lockerCode = locker?.code ?? "-";
                    const lockerName = locker?.name ?? "-";
                    const lockerLoc = locker?.location ?? "";

                    const jumlahAlat = 0;

                    return (
                      <tr key={e.id} className="border-b last:border-b-0">
                        <td className="py-4 pr-4 whitespace-nowrap">{formatDateTimeID(e.created_at)}</td>
                        <td className="py-4 pr-4">
                          <Link href={`/loker/${lockerCode}`} className="font-semibold hover:underline">
                            {lockerCode}
                          </Link>
                          <div className="text-xs text-gray-500">
                            {lockerName}
                            {lockerLoc ? ` • ${lockerLoc}` : ""}
                          </div>
                        </td>
                        <td className="py-4 pr-4">{e.nik}</td>
                        <td className="py-4 pr-4">
                          <ActionPill action={e.action} />
                        </td>
                        <td className="py-4 pr-4">{jumlahAlat}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-gray-500">Tips: klik kolom Locker untuk masuk detail locker.</div>
        </div>
      </div>
    </div>
  );
}
