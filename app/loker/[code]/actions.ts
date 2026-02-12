"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ActionState = { ok: boolean; message: string };

function toStr(v: unknown) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function toCodeNormFromUrl(code: string) {
  const digits = (code.match(/\d+/g) || []).join("");
  const last3 = digits.slice(-3);
  return last3.padStart(3, "0");
}

async function findLocker(supabase: any, code: string) {
  const codeParam = code.trim();
  const codeNorm = toCodeNormFromUrl(codeParam);

  const q1 = await supabase
    .from("lockers")
    .select("id, code, status, is_active, holder_nik")
    .eq("code_norm", codeNorm)
    .maybeSingle();

  if (q1.error) return { locker: null, error: q1.error };
  if (q1.data) return { locker: q1.data, error: null };

  const q2 = await supabase
    .from("lockers")
    .select("id, code, status, is_active, holder_nik")
    .eq("code", codeParam)
    .maybeSingle();

  if (q2.error) return { locker: null, error: q2.error };
  return { locker: q2.data, error: null };
}

async function validateNik(supabase: any, nik: string) {
  if (!/^\d+$/.test(nik)) return { ok: false as const, message: "NIK harus berupa angka." };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, nik, role, active")
    .eq("nik", nik)
    .maybeSingle();

  if (error) return { ok: false as const, message: `Gagal validasi NIK: ${error.message}` };
  if (!profile) return { ok: false as const, message: "NIK tidak terdaftar." };
  if (profile.active === false) return { ok: false as const, message: "User nonaktif." };
  if (profile.role && profile.role !== "TECH") return { ok: false as const, message: "NIK bukan teknisi." };

  return { ok: true as const, profile };
}

function parseMulti(formData: FormData, key: string): string[] {
  const vals = formData.getAll(key).map((v) => toStr(v).trim()).filter(Boolean);
  return Array.from(new Set(vals));
}

async function rollbackLockerToInUse(supabase: any, lockerId: number, nik: string) {
  await supabase
    .from("lockers")
    .update({
      status: "IN_USE",
      holder_nik: nik,
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", lockerId);
}

export async function checkoutAction(_prev: ActionState, formData: FormData | null): Promise<ActionState> {
  if (!formData) return { ok: false, message: "FormData kosong. Submit harus via <form action={...}>." };

  const code = toStr(formData.get("code")).trim();
  const nik = toStr(formData.get("nik")).trim();

  if (!code) return { ok: false, message: "Kode loker kosong." };
  if (!nik) return { ok: false, message: "NIK wajib diisi." };

  const supabase = await createClient();

  const nikCheck = await validateNik(supabase, nik);
  if (!nikCheck.ok) return { ok: false, message: nikCheck.message };

  const { locker, error } = await findLocker(supabase, code);
  if (error) return { ok: false, message: `Gagal ambil locker: ${error.message}` };
  if (!locker) return { ok: false, message: "Locker tidak ditemukan." };
  if (locker.is_active === false) return { ok: false, message: "Locker nonaktif." };

  const { data: updated, error: upErr } = await supabase
    .from("lockers")
    .update({
      status: "IN_USE",
      holder_nik: nik,
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", locker.id)
    .eq("status", "AVAILABLE")
    .select("id")
    .maybeSingle();

  if (upErr) return { ok: false, message: `Gagal update locker: ${upErr.message}` };
  if (!updated) return { ok: false, message: "Locker sudah IN_USE." };

  const { error: evErr } = await supabase.from("locker_events").insert({
    locker_id: locker.id,
    action: "CHECKOUT",
    nik,
    created_at: new Date().toISOString(),
    note: null,
  });

  if (evErr) {
    await supabase
      .from("lockers")
      .update({
        status: "AVAILABLE",
        holder_nik: null,
        status_updated_at: new Date().toISOString(),
      })
      .eq("id", locker.id);

    return { ok: false, message: `Gagal insert history: ${evErr.message}` };
  }

  revalidatePath(`/loker/${locker.code}`);
  revalidatePath(`/loker/${code}`);
  revalidatePath(`/admin/lockers/${locker.code}`);
  return { ok: true, message: "Checkout sukses." };
}

export async function checkinAction(_prev: ActionState, formData: FormData | null): Promise<ActionState> {
  if (!formData) return { ok: false, message: "FormData kosong. Submit harus via <form action={...}>." };

  const code = toStr(formData.get("code")).trim();
  const nik = toStr(formData.get("nik")).trim();

  if (!code) return { ok: false, message: "Kode loker kosong." };
  if (!nik) return { ok: false, message: "NIK wajib diisi." };

  const supabase = await createClient();
  const sbAdmin = supabaseAdmin();

  const nikCheck = await validateNik(supabase, nik);
  if (!nikCheck.ok) return { ok: false, message: nikCheck.message };

  const { locker, error } = await findLocker(supabase, code);
  if (error) return { ok: false, message: `Gagal ambil locker: ${error.message}` };
  if (!locker) return { ok: false, message: "Locker tidak ditemukan." };
  if (locker.is_active === false) return { ok: false, message: "Locker nonaktif." };

  // penting: pastikan yang checkin adalah pemegang locker
  if ((locker.status ?? "").toUpperCase() === "IN_USE" && locker.holder_nik && locker.holder_nik !== nik) {
    return { ok: false, message: `Locker sedang dipegang NIK ${locker.holder_nik}. Tidak bisa checkin pakai NIK ini.` };
  }

  // payload damage (format baru)
  const damagedFlag = toStr(formData.get("damaged")).trim(); // "1" or ""
  const damagedToolIds = parseMulti(formData, "damaged_tool_ids");
  const damagedNote = toStr(formData.get("damaged_note")).trim();

  const hasDamaged = damagedFlag === "1" && damagedToolIds.length > 0;

  const idsNum = damagedToolIds
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);

  // 1) update locker -> AVAILABLE (hanya kalau IN_USE)
  const { data: updated, error: upErr } = await supabase
    .from("lockers")
    .update({
      status: "AVAILABLE",
      holder_nik: null,
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", locker.id)
    .eq("status", "IN_USE")
    .select("id")
    .maybeSingle();

  if (upErr) return { ok: false, message: `Gagal update locker: ${upErr.message}` };
  if (!updated) return { ok: false, message: "Locker sudah AVAILABLE." };

  // 2) update tools -> DAMAGED (PAKAI ADMIN BIAR BYPASS RLS)
  if (hasDamaged) {
    if (idsNum.length === 0) {
      await rollbackLockerToInUse(supabase, locker.id, nik);
      return { ok: false, message: "Tool ID damaged tidak valid." };
    }

    const { data: updRows, error: toolUpdErr } = await sbAdmin
      .from("tools")
      .update({ status: "DAMAGED" })
      .in("id", idsNum)
      .eq("locker_id", locker.id)
      .eq("is_active", true)
      .select("id");

    if (toolUpdErr) {
      await rollbackLockerToInUse(supabase, locker.id, nik);
      return { ok: false, message: `Gagal update tools damaged: ${toolUpdErr.message}` };
    }

    if (!updRows || updRows.length === 0) {
      await rollbackLockerToInUse(supabase, locker.id, nik);
      return { ok: false, message: "Tidak ada tool yang ter-update jadi DAMAGED (cek tool_id / locker_id / is_active)." };
    }
  }

  // 3) insert history note
  const note = hasDamaged ? `DAMAGED(${idsNum.length}): ${damagedNote || "-"}` : null;

  const { error: evErr } = await supabase.from("locker_events").insert({
    locker_id: locker.id,
    action: "CHECKIN",
    nik,
    created_at: new Date().toISOString(),
    note,
  });

  if (evErr) return { ok: false, message: `Gagal insert history: ${evErr.message}` };

  revalidatePath(`/loker/${locker.code}`);
  revalidatePath(`/loker/${code}`);
  revalidatePath(`/admin/lockers/${locker.code}`);
  revalidatePath(`/admin`);

  return { ok: true, message: hasDamaged ? "Checkin sukses. Alat rusak tersimpan." : "Checkin sukses." };
}
