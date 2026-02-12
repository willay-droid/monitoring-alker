"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ActionResult = { ok: boolean; message: string };

const VALID_TOOL_STATUS = ["AVAILABLE", "DAMAGED"] as const;

function toCodeNormFromUrl(code: string) {
  const digits = (code.match(/\d+/g) || []).join("");
  const last3 = digits.slice(-3);
  return last3.padStart(3, "0");
}

async function findLockerIdByCode(sb: any, lockerCode: string) {
  const codeParam = String(lockerCode ?? "").trim();
  const codeNorm = toCodeNormFromUrl(codeParam);

  // prefer code_norm
  const q1 = await sb.from("lockers").select("id, code").eq("code_norm", codeNorm).maybeSingle();
  if (q1.error) return { locker: null as any, error: q1.error };
  if (q1.data) return { locker: q1.data, error: null };

  // fallback exact code
  const q2 = await sb.from("lockers").select("id, code").eq("code", codeParam).maybeSingle();
  if (q2.error) return { locker: null as any, error: q2.error };
  return { locker: q2.data, error: null };
}

export async function createToolInLocker(formData: FormData): Promise<ActionResult> {
  const lockerCode = String(formData.get("lockerCode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!lockerCode) return { ok: false, message: "Locker code kosong." };
  if (!name) return { ok: false, message: "Nama alat wajib diisi." };
  if (!category) return { ok: false, message: "Kategori wajib diisi." };

  const sb = supabaseAdmin();

  const { locker, error: lockerErr } = await findLockerIdByCode(sb, lockerCode);
  if (lockerErr) return { ok: false, message: lockerErr.message };
  if (!locker) return { ok: false, message: `Locker ${lockerCode} tidak ditemukan.` };

  const { error } = await sb.from("tools").insert({
    name,
    category,
    status: "AVAILABLE",
    locker_id: locker.id,
    is_active: true,
    updated_at: new Date().toISOString(),
  });

  if (error) return { ok: false, message: error.message };

  // revalidate canonical locker.code dari DB juga
  revalidatePath(`/admin/lockers/${locker.code}`);
  revalidatePath(`/admin/lockers/${lockerCode}`);
  revalidatePath("/admin");
  return { ok: true, message: "Alat berhasil ditambahkan." };
}

export async function updateTool(formData: FormData): Promise<ActionResult> {
  const lockerCode = String(formData.get("lockerCode") ?? "").trim();
  const toolId = Number(formData.get("toolId"));
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim().toUpperCase();

  if (!lockerCode) return { ok: false, message: "Locker code kosong." };
  if (!toolId || Number.isNaN(toolId)) return { ok: false, message: "Tool ID invalid." };
  if (!name) return { ok: false, message: "Nama alat wajib diisi." };
  if (!category) return { ok: false, message: "Kategori wajib diisi." };

  // kalau UI lama masih kirim IN_USE, kita tolak biar data gak kacau
  if (!VALID_TOOL_STATUS.includes(status as any)) {
    return { ok: false, message: "Status tool tidak valid. Gunakan AVAILABLE atau DAMAGED." };
  }

  const sb = supabaseAdmin();

  const { locker, error: lockerErr } = await findLockerIdByCode(sb, lockerCode);
  if (lockerErr) return { ok: false, message: lockerErr.message };
  if (!locker) return { ok: false, message: `Locker ${lockerCode} tidak ditemukan.` };

  // safety: pastikan tool ini milik locker tsb
  const { data: tool, error: toolErr } = await sb
    .from("tools")
    .select("id, locker_id, is_active")
    .eq("id", toolId)
    .maybeSingle();

  if (toolErr) return { ok: false, message: toolErr.message };
  if (!tool || tool.is_active === false) return { ok: false, message: "Tool tidak ditemukan / sudah dihapus." };
  if (Number(tool.locker_id) !== Number(locker.id)) return { ok: false, message: "Tool tidak milik locker ini." };

  const { error } = await sb
    .from("tools")
    .update({ name, category, status, updated_at: new Date().toISOString() })
    .eq("id", toolId)
    .eq("locker_id", locker.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/lockers/${locker.code}`);
  revalidatePath(`/admin/lockers/${lockerCode}`);
  revalidatePath("/admin");
  return { ok: true, message: "Alat berhasil diupdate." };
}

export async function deleteTool(formData: FormData): Promise<ActionResult> {
  const lockerCode = String(formData.get("lockerCode") ?? "").trim();
  const toolId = Number(formData.get("toolId"));

  if (!lockerCode) return { ok: false, message: "Locker code kosong." };
  if (!toolId || Number.isNaN(toolId)) return { ok: false, message: "Tool ID invalid." };

  const sb = supabaseAdmin();

  const { locker, error: lockerErr } = await findLockerIdByCode(sb, lockerCode);
  if (lockerErr) return { ok: false, message: lockerErr.message };
  if (!locker) return { ok: false, message: `Locker ${lockerCode} tidak ditemukan.` };

  // safety: pastikan tool milik locker tsb
  const { data: tool, error: toolErr } = await sb
    .from("tools")
    .select("id, locker_id, is_active")
    .eq("id", toolId)
    .maybeSingle();

  if (toolErr) return { ok: false, message: toolErr.message };
  if (!tool || tool.is_active === false) return { ok: false, message: "Tool tidak ditemukan / sudah dihapus." };
  if (Number(tool.locker_id) !== Number(locker.id)) return { ok: false, message: "Tool tidak milik locker ini." };

  // soft delete
  const { error } = await sb
    .from("tools")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", toolId)
    .eq("locker_id", locker.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/lockers/${locker.code}`);
  revalidatePath(`/admin/lockers/${lockerCode}`);
  revalidatePath("/admin");
  return { ok: true, message: "Alat berhasil dihapus." };
}

/**
 * OPTIONAL (kalau UI admin ada tombol "Mark Fixed"):
 * tool.status: DAMAGED -> AVAILABLE
 */
export async function markToolFixed(formData: FormData) {
  const lockerCode = String(formData.get("lockerCode") ?? "").trim();
  const toolId = Number(formData.get("toolId"));

  if (!lockerCode) return { ok: false, message: "Locker code kosong." };
  if (!toolId || Number.isNaN(toolId)) return { ok: false, message: "Tool ID invalid." };

  const sb = supabaseAdmin();

  // Pastikan tool ada & memang DAMAGED
  const { data: tool, error: toolErr } = await sb
    .from("tools")
    .select("id, status, locker_id")
    .eq("id", toolId)
    .maybeSingle();

  if (toolErr) return { ok: false, message: toolErr.message };
  if (!tool) return { ok: false, message: "Tool tidak ditemukan." };

  const status = String(tool.status ?? "").toUpperCase();
  if (status !== "DAMAGED") return { ok: false, message: "Tool bukan status DAMAGED." };

  // Update jadi AVAILABLE
  const { error: upErr } = await sb
    .from("tools")
    .update({ status: "AVAILABLE" })
    .eq("id", toolId);

  if (upErr) return { ok: false, message: upErr.message };

  // Optional: audit ke history locker_events
  // NIK kita isi 'ADMIN' aja (atau nanti kalau ada login admin, pakai nik admin)
  const { error: evErr } = await sb.from("locker_events").insert({
    locker_id: tool.locker_id,
    action: "MARK_FIXED",
    nik: "ADMIN",
    created_at: new Date().toISOString(),
    note: `FIXED tool_id=${toolId}`,
  });

  if (evErr) {
    // gak rollback tools (karena status sudah fixed), tapi kasih warning
    // return warning biar lo tahu
    revalidatePath(`/admin/lockers/${lockerCode}`);
    revalidatePath("/admin");
    return { ok: true, message: `Tool fixed, tapi gagal insert history: ${evErr.message}` };
  }

  revalidatePath(`/admin/lockers/${lockerCode}`);
  revalidatePath("/admin");
  return { ok: true, message: "Tool berhasil di-Mark Fixed." };
}

