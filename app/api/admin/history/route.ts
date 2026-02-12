import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = [10, 50, 100].includes(Number(searchParams.get("pageSize")))
      ? Number(searchParams.get("pageSize"))
      : 50;

    const lockerCode = (searchParams.get("locker") || "").trim(); // "" = semua
    const sort = (searchParams.get("sort") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Kalau filter locker dipakai -> resolve locker_id & ambil tool_id list dari tools
    let allowedToolIds: number[] | null = null;

    if (lockerCode) {
      const { data: lockerRow, error: lockerErr } = await supabase
        .from("lockers")
        .select("id, code")
        .eq("code", lockerCode)
        .maybeSingle();

      if (lockerErr) throw new Error(lockerErr.message);

      // Kalau code locker gak ada -> return kosong
      if (!lockerRow?.id) {
        return NextResponse.json({
          ok: true,
          page,
          pageSize,
          total: 0,
          totalPages: 1,
          rows: [],
        });
      }

      const { data: toolsInLocker, error: toolsErr } = await supabase
        .from("tools")
        .select("id")
        .eq("locker_id", lockerRow.id);

      if (toolsErr) throw new Error(toolsErr.message);

      allowedToolIds = (toolsInLocker || []).map((t: any) => t.id);

      // kalau locker ada tapi belum ada tools -> kosong
      if (allowedToolIds.length === 0) {
        return NextResponse.json({
          ok: true,
          page,
          pageSize,
          total: 0,
          totalPages: 1,
          rows: [],
        });
      }
    }

    // Ambil events (tanpa tool_count, karena 1 row = 1 tool)
    let q = supabase
      .from("tool_events")
      .select("id, created_at, event_type, tool_id, nik", { count: "exact" })
      .order("created_at", { ascending: sort === "asc" })
      .range(from, to);

    if (allowedToolIds) q = q.in("tool_id", allowedToolIds);

    const { data: events, error: evErr, count } = await q;
    if (evErr) throw new Error(evErr.message);

    const toolIds = Array.from(
      new Set((events || []).map((e: any) => e.tool_id).filter(Boolean))
    ) as number[];

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
        if (t?.id != null && t?.locker_id != null) {
          toolToLocker.set(t.id, t.locker_id);
        }
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

    const rows = (events || []).map((e: any) => {
      const lId = toolToLocker.get(e.tool_id);
      return {
        id: e.id,
        time: e.created_at,
        locker: lId ? lockerMap.get(lId) || "-" : "-",
        nik: e.nik,
        action: e.event_type,
        tool_count: 1, // ✅ 1 row = 1 alat
      };
    });

    return NextResponse.json({
      ok: true,
      page,
      pageSize,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
      rows,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}
