import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AdminPageHeader from "../AdminPageHeader";
import AddLockerPopover from "./AddLockerPopover";
import EditLockerPopover from "./EditLockerPopover";
import DeleteLockerButton from "./DeleteLockerButton";

type LockerRow = {
  id: number;
  code: string;
  name: string | null;
  location: string | null;
  status?: string | null;
};

type ToolMini = {
  locker_id: number | null;
  status: string | null;
  is_active: boolean | null;
};

type Stat = {
  total: number;
  available: number;
  damaged: number;
  inUse: number;
};

export default async function AdminLockersPage() {
  const supabase = supabaseAdmin();

  // 1) Ambil list lockers
  const { data: lockers, error } = await supabase
    .from("lockers")
    .select("id, code, name, location, status")
    .eq("is_active", true)
    .order("code", { ascending: true });

  if (error) throw new Error(error.message);

  const lockerList: LockerRow[] = (lockers ?? []) as any;

  // 2) Ambil tools minimal untuk hitung ringkasan
  // (lebih robust daripada view tools_dashboard yang bisa gak sinkron)
  const { data: tools, error: toolErr } = await supabase
    .from("tools")
    .select("locker_id, status, is_active");

  if (toolErr) throw new Error(toolErr.message);

  const stats = new Map<number, Stat>();

  for (const t of (tools ?? []) as ToolMini[]) {
    if (!t?.is_active) continue;
    if (!t.locker_id) continue;

    const cur = stats.get(t.locker_id) ?? { total: 0, available: 0, damaged: 0, inUse: 0 };
    cur.total += 1;

    const st = String(t.status ?? "").toUpperCase();
    if (st === "AVAILABLE") cur.available += 1;
    else if (st === "IN_USE") cur.inUse += 1;
    else if (st === "DAMAGED") cur.damaged += 1;

    stats.set(t.locker_id, cur);
  }

  return (
    <div>
      <AdminPageHeader
        title="Kelola Locker"
        subtitle="List locker + ringkasan jumlah alat."
        actions={
          <>

            {/* tombol tambah locker (popover) */}
            <AddLockerPopover />
          </>
        }
      />

      <div className="mt-6 rounded-2xl border bg-white p-6">
        <div className="mb-4">
          <div className="text-sm font-semibold">Daftar Locker</div>
          <div className="text-xs text-gray-500">Klik “Kelola Alat” untuk CRUD tools.</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="py-3 pr-4">Kode</th>
                <th className="py-3 pr-4">Nama</th>
                <th className="py-3 pr-4">Lokasi</th>
                <th className="py-3 pr-4">Total</th>
                <th className="py-3 pr-4">Available</th>
                <th className="py-3 pr-4">Damaged</th>
                <th className="py-3 pr-4">In Use</th>
                <th className="py-3 text-right">Aksi</th>
              </tr>
            </thead>

            <tbody>
              {lockerList.map((l) => {
                const st = stats.get(l.id) ?? { total: 0, available: 0, damaged: 0, inUse: 0 };

                return (
                  <tr key={l.id} className="border-b last:border-b-0">
                    <td className="py-4 pr-4 font-semibold">{l.code}</td>
                    <td className="py-4 pr-4">{l.name ?? "-"}</td>
                    <td className="py-4 pr-4">{l.location ?? "-"}</td>

                    <td className="py-4 pr-4">{st.total}</td>
                    <td className="py-4 pr-4 text-emerald-700 font-semibold">{st.available}</td>
                    <td className="py-4 pr-4 text-red-600 font-semibold">{st.damaged}</td>
                    <td className="py-4 pr-4 text-blue-700 font-semibold">{st.inUse}</td>

                    <td className="py-4 text-right">
                      <div className="inline-flex gap-2">
                        <Link
                          href={`/admin/lockers/${l.code}`}
                          className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-gray-50"
                        >
                          Kelola Alat →
                        </Link>

                        <EditLockerPopover code={l.code} name={l.name} location={l.location} />
                        <DeleteLockerButton code={l.code} />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {lockerList.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-gray-500">
                    Belum ada locker.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* debug kecil (boleh hapus) */}
        {/* <pre className="mt-4 text-xs text-gray-500">{JSON.stringify([...stats.entries()], null, 2)}</pre> */}
      </div>
    </div>
  );
}
