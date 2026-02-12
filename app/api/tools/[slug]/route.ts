import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient();
  const { slug } = await ctx.params;

  const { data: tool, error } = await supabase
    .from("tools")
    .select("*")
    .eq("qr_code", slug)
    .single();

  if (error || !tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  const { data: history, error: hErr } = await supabase
    .from("tool_events")
    .select("id,event_time,event_type,nik,note,condition,sto_code")
    .eq("tool_id", tool.id)
    .order("event_time", { ascending: false })
    .limit(20);

  return NextResponse.json({
    tool,
    history: hErr ? [] : history ?? [],
  });
}
