import { supabaseAdmin } from "@/lib/supabase/admin";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const lockerCode = decodeURIComponent(code);

  const { searchParams } = new URL(req.url);
  const orderRaw = (searchParams.get("order") || "desc").toLowerCase();
  const order = orderRaw === "asc" ? "asc" : "desc";

  const sb = supabaseAdmin();

  // cari locker_id dari code
  const { data: locker, error: lockerErr } = await sb
    .from("lockers")
    .select("id, code")
    .eq("code", lockerCode)
    .maybeSingle();

  if (lockerErr) {
    return new Response(`Gagal load locker: ${lockerErr.message}`, { status: 500 });
  }
  if (!locker) {
    return new Response(`Locker tidak ditemukan: ${lockerCode}`, { status: 404 });
  }

  const { data, error } = await sb
    .from("locker_events")
    .select("id, locker_id, nik, action, created_at, note")
    .eq("locker_id", locker.id)
    .order("created_at", { ascending: order === "asc" });

  if (error) {
    return new Response(`Gagal load history: ${error.message}`, { status: 500 });
  }

  const rows = (data ?? []).map((r: any, idx: number) => ({
    No: idx + 1,
    Locker: lockerCode,
    NIK: r.nik ?? "",
    Aksi: String(r.action ?? "-").toUpperCase(),
    Tanggal: r.created_at ?? "",
    Note: r.note ?? "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "History");

  ws["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 24 }, { wch: 40 }];

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="history-${lockerCode}.xlsx"`,
    },
  });
}
