"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

function normalizeLockerCodeFromAny(input: string) {
  // input bisa: "1" | "001" | "LOKER-1" | "LOKER-001"
  const raw = String(input ?? "").trim().toUpperCase();
  if (!raw) throw new Error("Nomor/Kode wajib diisi.");

  // kalau pure angka
  if (/^\d{1,3}$/.test(raw)) {
    const num = Number(raw);
    if (Number.isNaN(num) || num < 1 || num > 999) throw new Error("Nomor locker harus 1–999.");
    const n3 = pad3(num);
    return { code: `LOKER-${n3}`, code_norm: n3 };
  }

  // kalau format LOKER-x
  const m = raw.match(/^LOKER-(\d{1,3})$/);
  if (m) {
    const num = Number(m[1]);
    if (Number.isNaN(num) || num < 1 || num > 999) throw new Error("Nomor locker harus 1–999.");
    const n3 = pad3(num);
    return { code: `LOKER-${n3}`, code_norm: n3 };
  }

  throw new Error("Input tidak valid. Isi nomor 1–999.");
}

/**
 * CREATE (opsi A): input nomor saja, server generate code & code_norm
 */
export async function createLocker(formData: FormData) {
  const lockerNumber = String(formData.get("locker_number") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();

  if (!lockerNumber) return { ok: false, message: "Nomor wajib diisi." };
  if (!name) return { ok: false, message: "Nama wajib diisi." };
  if (!location) return { ok: false, message: "Lokasi wajib diisi." };

  let normalized;
  try {
    normalized = normalizeLockerCodeFromAny(lockerNumber);
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Nomor tidak valid." };
  }

  const sb = supabaseAdmin();

  // anti duplikat (aktif)
  const { data: exist, error: existErr } = await sb
    .from("lockers")
    .select("id")
    .eq("code_norm", normalized.code_norm)
    .eq("is_active", true)
    .maybeSingle();

  if (existErr) return { ok: false, message: existErr.message };
  if (exist) return { ok: false, message: `Locker ${normalized.code} sudah ada.` };

  const now = new Date().toISOString();

  const { error } = await sb.from("lockers").insert({
    code: normalized.code,
    code_norm: normalized.code_norm,
    name,
    location,
    is_active: true,
    status: "AVAILABLE",
    holder_nik: null,
    status_updated_at: now,
    updated_at: now,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/lockers");
  revalidatePath("/admin");
  return { ok: true, message: "Locker berhasil ditambahkan." };
}

/**
 * UPDATE: edit hanya name & location (kode dikunci)
 */
export async function updateLocker(formData: FormData) {
  const code = String(formData.get("originalCode") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();

  if (!code) return { ok: false, message: "Kode locker kosong." };
  if (!name) return { ok: false, message: "Nama wajib diisi." };
  if (!location) return { ok: false, message: "Lokasi wajib diisi." };

  const sb = supabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await sb
    .from("lockers")
    .update({ name, location, updated_at: now })
    .eq("code", code);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/lockers");
  revalidatePath("/admin");
  return { ok: true, message: "Locker berhasil diupdate." };
}

/**
 * DELETE: soft delete (is_active=false)
 * ditolak kalau masih ada tools aktif dalam locker
 */
export async function deleteLocker(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) return { ok: false, message: "Kode locker kosong." };

  const sb = supabaseAdmin();

  // ambil id locker
  const { data: locker, error: lockerErr } = await sb
    .from("lockers")
    .select("id")
    .eq("code", code)
    .maybeSingle();

  if (lockerErr) return { ok: false, message: lockerErr.message };
  if (!locker) return { ok: false, message: "Locker tidak ditemukan." };

  // cek masih ada tools aktif?
  const { count, error: cntErr } = await sb
    .from("tools")
    .select("id", { count: "exact", head: true })
    .eq("locker_id", locker.id)
    .eq("is_active", true);

  if (cntErr) return { ok: false, message: cntErr.message };
  if ((count ?? 0) > 0) {
    return { ok: false, message: `Tidak bisa hapus. Masih ada ${count} alat aktif di locker ini.` };
  }

  const { error } = await sb.from("lockers").update({ is_active: false }).eq("id", locker.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/lockers");
  revalidatePath("/admin");
  return { ok: true, message: "Locker berhasil dihapus (soft delete)." };
}
