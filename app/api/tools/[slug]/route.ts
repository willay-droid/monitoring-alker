	import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;

  const { data: tool, error } = await supabaseServer
    .from("tools")
    .select("*")
    .eq("qr_code", slug)
    .single();

  if (error || !tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  const { data: history, error: hErr } = await supabaseServer
    .from("tool_events")
    .select("id,event_time,event_type,nik,note,condition,sto_code") // ✅ tambah id
    .eq("tool_id", tool.id)
    .order("event_time", { ascending: false })
    .limit(20);

  if (hErr) {
    // masih balikin tool minimal biar UI gak crash
    return NextResponse.json({ tool, history: [] });
  }

  return NextResponse.json({ tool, history: history ?? [] });
}
