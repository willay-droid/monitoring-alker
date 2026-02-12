import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateNikOrThrow } from "@/lib/validateNik";
import { getOpenCheckoutSessionId } from "@/lib/openCheckout";

export const runtime = "nodejs";

type Body = {
  nik: string;
  toolIds: number[];
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const lockerCode = decodeURIComponent(code);

    const body = (await req.json()) as Body;
    const toolIds = Array.isArray(body.toolIds) ? body.toolIds : [];
    if (toolIds.length === 0) {
      return Response.json({ ok: false, error: "ToolIds kosong." }, { status: 400 });
    }

    const profile = await validateNikOrThrow(body.nik);
    const sb = supabaseAdmin();

    // locker_id
    const { data: locker, error: lErr } = await sb
      .from("lockers")
      .select("id")
      .eq("code", lockerCode)
      .single();

    if (lErr || !locker) {
      return Response.json({ ok: false, error: "Locker tidak ditemukan." }, { status: 400 });
    }
    const lockerId = locker.id as number;

    // cegah checkout kalau masih ada open checkout
    const openCheckoutId = await getOpenCheckoutSessionId(lockerId);
    if (openCheckoutId) {
      return Response.json(
        { ok: false, error: `Masih ada checkout aktif (id: ${openCheckoutId}). Silakan checkin dulu.` },
        { status: 400 }
      );
    }

    // validasi tools milik locker & AVAILABLE
    const { data: tools, error: tErr } = await sb
      .from("tools")
      .select("id, status, locker_id")
      .in("id", toolIds)
      .eq("locker_id", lockerId);

    if (tErr) throw new Error(tErr.message);
    if (!tools || tools.length !== toolIds.length) {
      return Response.json({ ok: false, error: "Ada tool yang tidak milik locker ini." }, { status: 400 });
    }

    const notAvailable = tools.filter(
      (t: any) => String(t.status ?? "").toUpperCase() !== "AVAILABLE"
    );
    if (notAvailable.length > 0) {
      return Response.json({ ok: false, error: "Ada tool yang tidak AVAILABLE." }, { status: 400 });
    }

    // create session CHECKOUT
    const { data: session, error: sErr } = await sb
      .from("locker_sessions")
      .insert({
        locker_id: lockerId,
        nik: profile.nik,
        session_type: "CHECKOUT",
      })
      .select("id")
      .single();

    if (sErr) throw new Error(sErr.message);
    const sessionId = session.id as number;

    // session items
    const items = toolIds.map((toolId) => ({ session_id: sessionId, tool_id: toolId }));
    const { error: iErr } = await sb.from("locker_session_items").insert(items);
    if (iErr) throw new Error(iErr.message);

    // update tools -> IN_USE + holder
    const now = new Date().toISOString();
    const { error: uErr } = await sb
      .from("tools")
      .update({
        status: "IN_USE",
        current_holder: profile.nik,
        current_holder_at: now,
        last_event_type: "CHECKOUT",
        last_event_at: now,
        last_event_note: null,
      })
      .in("id", toolIds);
    if (uErr) throw new Error(uErr.message);

    // ✅ tool_events (condition harus OK/DAMAGED)
    const events = toolIds.map((toolId) => ({
      event_type: "CHECKOUT",
      tool_id: toolId,
      condition: "OK",
      note: null,
      event_time: now,
      nik: profile.nik,
    }));

    const { error: eErr } = await sb.from("tool_events").insert(events);
    if (eErr) throw new Error(eErr.message);

    return Response.json({ ok: true, sessionId });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "Gagal checkout." }, { status: 400 });
  }
}
