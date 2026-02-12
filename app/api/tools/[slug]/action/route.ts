import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Action = "CHECKOUT" | "CHECKIN" | "REPORT_DAMAGED" | "MARK_FIXED";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = createClient();
    const { slug } = await ctx.params;

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

    const { data: tool, error: tErr } = await supabase
      .from("tools")
      .select("*")
      .eq("qr_code", slug)
      .single();

    if (tErr || !tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    if (action === "CHECKOUT" && tool.status !== "AVAILABLE")
      return NextResponse.json({ error: "Tool not available" }, { status: 409 });

    if (action === "CHECKIN" && tool.status !== "IN_USE")
      return NextResponse.json({ error: "Tool not in use" }, { status: 409 });

    if (action === "REPORT_DAMAGED" && tool.status === "DAMAGED")
      return NextResponse.json({ error: "Already damaged" }, { status: 409 });

    if (action === "MARK_FIXED" && tool.status !== "DAMAGED")
      return NextResponse.json({ error: "Tool is not damaged" }, { status: 409 });

    const now = new Date().toISOString();

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

    const { error: eErr } = await supabase.from("tool_events").insert({
      tool_id: tool.id,
      event_type: action,
      nik,
      note: action === "REPORT_DAMAGED" ? note : null,
      event_time: now,
    });

    if (eErr) {
      return NextResponse.json({ error: eErr.message }, { status: 500 });
    }

    const { error: uErr, data: updated } = await supabase
      .from("tools")
      .update({
        status: nextStatus,
        current_holder_nik: holderNik,
        last_event_at: now,
      })
      .eq("id", tool.id)
      .select("*")
      .single();

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, tool: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
