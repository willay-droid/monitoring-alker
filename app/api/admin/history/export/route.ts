import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const lockerCode = (searchParams.get("locker") || "").trim();
    const sort = (searchParams.get("sort") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    // kalau filter locker dipakai -> resolve locker_id & ambil tool_id list dari tools
    let allowedToolIds: number[] | null = null;

    if (lockerCode) {
      const { data: lockerRow, error: lockerErr } = await supabase
        .from("lockers")
        .select("id, code")
        .eq("code", lockerCode)
        .maybeSingle();

      if (lockerErr) throw new Error(lockerErr.message);

      if (!lockerRow?.id) {
        // return excel kosong
        allowedToolIds = [];
      } else {
        const { data: toolsInLocker, error: toolsErr } = await supabase
          .from("tools")
          .select("id")
          .eq("locker_id", lockerRow.id);

        if (toolsErr) throw new Error(toolsErr.message);

        allowedToolIds = (toolsInLocker || []).map((t: any) => t.id);
      }
    }

    const LIMIT = 10000;

    let q = supabase
      .from("tool_events")
      .select("id, created_at, event_type, tool_id, nik")
      .order("created_at", { ascending: sort === "asc" })
      .limit(LIMIT);

    if (allowedToolIds) {
      // lockerCode ada: kalau kosong -> hasil kosong
      if (allowedToolIds.length === 0) {
        q = q.in("tool_id", [-1]); // biar kosong aman
      } else {
        q = q.in("tool_id", allowedToolIds);
      }
    }

    const { data: events, error: evErr } = await q;
    if (evErr) throw new Error(evErr.message);

    const toolIds = Array.from(new Set((events || []).map((e: any) => e.tool_id).filter(Boolean))) as number[];

    // Map tool_id -> locker_id
    const toolToLocker = new Map<number, number>();
    let lockerIds: number[] = [];

    if (toolIds.length > 0) {
      const { data: toolsRows, error: toolsErr2 } = await supabase
        .from("tools")
        .select("id, locker_id")
        .in("id", toolIds);

      if (toolsErr2) throw new Error(toolsErr2.message);

      (toolsRows || []).forEach((t: any) => {
        if (t?.id != null && t?.locker_id != null) toolToLocker.set(t.id, t.locker_id);
      });

      lockerIds = Array.from(new Set((toolsRows || []).map((t: any) => t.locker_id).filter(Boolean)));
    }

    // Map locker_id -> locker_code
    const lockerMap = new Map<number, string>();
    if (lockerIds.length > 0) {
      const { data: lockerRows, error: lockErr } = await supabase
        .from("lockers")
        .select("id, code")
        .in("id", lockerIds);

      if (lockErr) throw new Error(lockErr.message);
      (lockerRows || []).forEach((l: any) => lockerMap.set(l.id, l.code));
    }

    // Build XLSX
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("History");

    ws.columns = [
      { header: "Waktu", key: "time", width: 22 },
      { header: "Locker", key: "locker", width: 14 },
      { header: "NIK", key: "nik", width: 16 },
      { header: "Aksi", key: "action", width: 12 },
      { header: "Jumlah Alat", key: "tool_count", width: 12 },
    ];

    (events || []).forEach((e: any) => {
      const lId = toolToLocker.get(e.tool_id);
      ws.addRow({
        time: e.created_at,
        locker: lId ? lockerMap.get(lId) || "-" : "-",
        nik: e.nik,
        action: e.event_type,
        tool_count: 1, // ✅ 1 row = 1 alat
      });
    });

    ws.getRow(1).font = { bold: true };

    const buffer = await wb.xlsx.writeBuffer();
    const filename = lockerCode ? `history_${lockerCode}.xlsx` : "history_all.xlsx";

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}
