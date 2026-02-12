import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";

type Action = "CHECKOUT" | "CHECKIN" | "REPORT_DAMAGED" | "MARK_FIXED";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await ctx.params;

    // guard supabase
    if (!supabaseServer || typeof (supabaseServer as any).from !== "function") {
      console.error("supabaseServer is not initialized");
      return NextResponse.json(
        { error: "supabaseServer not initialized" },
        { status: 500 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const action = body?.action as Action | undefined;
    const nik = String(body?.nik ?? "").trim();
    const note = body?.note != null ? String(body.note) : null;

    if (!action || !["CHECKOUT", "CHECKIN", "REPORT_DAMAGED", "MARK_FIXED"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (!nik) {
      return NextResponse.json({ error: "NIK is required" }, { status: 400 });
    }

    // ambil tool by qr_code
    const { data: tool, error: tErr } = await supabaseServer
      .from("tools")
      .select("*")
      .eq("qr_code", slug)
      .single();

    if (tErr || !tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // rules sederhana
    if (action === "CHECKOUT" && tool.status !== "AVAILABLE")
      return NextResponse.json({ error: "Tool not available" }, { status: 409 });

    if (action === "CHECKIN" && tool.status !== "IN_USE")
      return NextResponse.json({ error: "Tool not in use" }, { status: 409 });

    if (action === "REPORT_DAMAGED" && tool.status === "DAMAGED")
      return NextResponse.json({ error: "Already damaged" }, { status: 409 });

    if (action === "MARK_FIXED" && tool.status !== "DAMAGED")
      return NextResponse.json({ error: "Tool is not damaged" }, { status: 409 });

    const now = new Date().toISOString();

    // next state
    let nextStatus = tool.status as string;
    let holderNik: string | null = tool.current_holder_nik ?? null;

    if (action === "CHECKOUT") {
      nextStatus = "IN_USE";
      holderNik = nik;
    } else if (action === "CHECKIN") {
      nextStatus = "AVAILABLE";
      holderNik = null;
    } else if (action === "REPORT_DAMAGED") {
      nextStatus = "DAMAGED";
    } else if (action === "MARK_FIXED") {
      nextStatus = "AVAILABLE";
      holderNik = null;
    }

    // ⚠️ INSERT EVENT: mulai dari yang "pasti ada" dulu
    // Kalau tabel lo punya kolom tambahan (condition/sto_code/event_time), nanti kita tambah lagi.
    const eventPayload: any = {
      tool_id: tool.id,
      event_type: action,
      nik,
      note: action === "REPORT_DAMAGED" ? note : null,
      event_time: now, // kalau kolom ini gak ada, nanti error-nya kebaca jelas
    };

    const { error: eErr } = await supabaseServer.from("tool_events").insert(eventPayload);
    if (eErr) {
      console.error("INSERT tool_events error:", eErr);
      return NextResponse.json({ error: eErr.message }, { status: 500 });
    }

    // UPDATE TOOLS: juga mulai yang aman
    const updatePayload: any = {
      status: nextStatus,
      current_holder_nik: holderNik,
      last_event_at: now, // kalau gak ada, error kebaca jelas
    };

    const { error: uErr, data: updated } = await supabaseServer
      .from("tools")
      .update(updatePayload)
      .eq("id", tool.id)
      .select("*")
      .single();

    if (uErr) {
      console.error("UPDATE tools error:", uErr);
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, tool: updated });
  } catch (err: any) {
    console.error("ACTION_ROUTE_FATAL:", err);
    return NextResponse.json(
      { error: err?.message ?? String(err) ?? "Internal server error" },
      { status: 500 }
    );
  }
}
