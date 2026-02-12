import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const q = (searchParams.get("q") ?? "").trim();

    let query = supabase
      .from("tools")
      .select("id,name,qr_code,category,status,current_holder_nik,last_event_at")
      .order("name", { ascending: true });

    if (status && ["AVAILABLE", "IN_USE", "DAMAGED"].includes(status)) {
      query = query.eq("status", status);
    }

    if (q) {
      query = query.or(`name.ilike.%${q}%,qr_code.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ tools: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
