import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateNikOrThrow } from "@/lib/validateNik";
import { getOpenCheckoutSessionId } from "@/lib/openCheckout";

export const runtime = "nodejs";

type DamagedItem = { tool_id: number; note: string };

type Body = {
  nik: string;
  toolIds: number[];
  damaged?: DamagedItem[];
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
    const damaged = Array.isArray(body.damaged) ? body.damaged : [];
    const damagedSet = new Set(damaged.map((d) => d.tool_id));

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

    // cari open checkout (prioritas nik sama)
    const openCheckoutId =
      (await getOpenCheckoutSessionId(lockerId, profile.nik)) ??
      (await getOpenCheckoutSessionId(lockerId));

    if (!openCheckoutId) {
      return Response.json({ ok: false, error: "Tidak ada checkout aktif untuk di-checkin." }, { status: 400 });
    }

    // validasi tools milik locker
    const { data: tools, error: tErr } = await sb
      .from("tools")
      .select("id, locker_id")
      .in("id", toolIds)
      .eq("locker_id", lockerId);

    if (tErr) throw new Error(tErr.message);
    if (!tools || tools.length !== toolIds.length) {
      return Response.json({ ok: false, error: "Ada tool yang tidak milik locker ini." }, { status: 400 });
    }

    // create session CHECKIN + pairing
    const { data: session, error: sErr } = await sb
      .from("locker_sessions")
      .insert({
        locker_id: lockerId,
        nik: profile.nik,
        session_type: "CHECKIN",
        pair_checkout_id: openCheckoutId,
      })
      .select("id")
      .single();

    if (sErr) throw new Error(sErr.message);
    const sessionId = session.id as number;

    // session items
    const items = toolIds.map((toolId) => ({ session_id: sessionId, tool_id: toolId }));
    const { error: iErr } = await sb.from("locker_session_items").insert(items);
    if (iErr) throw new Error(iErr.message);

    // update tools -> AVAILABLE / DAMAGED
    const now = new Date().toISOString();
    const availableIds = toolIds.filter((id) => !damagedSet.has(id));
    const damagedIds = toolIds.filter((id) => damagedSet.has(id));

    if (availableIds.length > 0) {
      const { error } = await sb
        .from("tools")
        .update({
          status: "AVAILABLE",
          current_holder: null,
          current_holder_at: null,
          last_event_type: "CHECKIN",
          last_event_at: now,
          last_event_note: null,
        })
        .in("id", availableIds);
      if (error) throw new Error(error.message);
    }

    if (damagedIds.length > 0) {
      const { error } = await sb
        .from("tools")
        .update({
          status: "DAMAGED",
          current_holder: null,
          current_holder_at: null,
          last_event_type: "CHECKIN",
          last_event_at: now,
          last_event_note: "DAMAGED",
        })
        .in("id", damagedIds);
      if (error) throw new Error(error.message);
    }

    // damage_reports + items
    if (damaged.length > 0) {
      const { data: report, error: rErr } = await sb
        .from("damage_reports")
        .insert({
          locker_id: lockerId,
          nik: profile.nik,
          note: null,
        })
        .select("id")
        .single();

      if (rErr) throw new Error(rErr.message);

      const rows = damaged.map((d) => ({
        report_id: report.id,
        tool_id: d.tool_id,
        note: d.note,
      }));

      const { error: riErr } = await sb.from("damage_report_items").insert(rows);
      if (riErr) throw new Error(riErr.message);
    }

    // ✅ tool_events (condition OK/DAMAGED)
    const events = toolIds.map((toolId) => ({
      event_type: "CHECKIN",
      tool_id: toolId,
      condition: damagedSet.has(toolId) ? "DAMAGED" : "OK",
      note: damagedSet.has(toolId)
        ? (damaged.find((d) => d.tool_id === toolId)?.note ?? null)
        : null,
      event_time: now,
      nik: profile.nik,
    }));

    const { error: eErr } = await sb.from("tool_events").insert(events);
    if (eErr) throw new Error(eErr.message);

    return Response.json({ ok: true, sessionId, pairedCheckoutId: openCheckoutId });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "Gagal checkin." }, { status: 400 });
  }
}
