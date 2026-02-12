import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getOpenCheckoutSessionId(lockerId: number, nik?: string) {
  const sb = supabaseAdmin();

  // ambil daftar pair_checkout_id yang sudah dipakai oleh CHECKIN
  const { data: pairedRows, error: pErr } = await sb
    .from("locker_sessions")
    .select("pair_checkout_id")
    .eq("locker_id", lockerId)
    .eq("session_type", "CHECKIN")
    .not("pair_checkout_id", "is", null);

  if (pErr) throw new Error(pErr.message);

  const pairedIds = new Set<number>(
    (pairedRows ?? [])
      .map((r: any) => r.pair_checkout_id)
      .filter((x: any) => typeof x === "number")
  );

  // cari checkout terbaru (opsional: berdasarkan nik)
  let q = sb
    .from("locker_sessions")
    .select("id, nik, created_at")
    .eq("locker_id", lockerId)
    .eq("session_type", "CHECKOUT")
    .order("created_at", { ascending: false })
    .limit(20);

  if (nik) q = q.eq("nik", nik);

  const { data: checkoutRows, error: cErr } = await q;
  if (cErr) throw new Error(cErr.message);

  const open = (checkoutRows ?? []).find((r: any) => !pairedIds.has(r.id));
  return open?.id ?? null;
}
