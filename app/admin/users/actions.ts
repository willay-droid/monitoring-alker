"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ProfileRow = {
  id: string;
  nik: string;
  name: string;
  role: "ADMIN" | "TECH";
  active: boolean;
  created_at: string;
};

type ActionResult = { ok: boolean; message: string };

export async function listProfiles(): Promise<ProfileRow[]> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nik, name, role, active, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ProfileRow[];
}

export async function createProfile(formData: FormData): Promise<ActionResult> {
  const supabase = supabaseAdmin();

  const nik = String(formData.get("nik") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim().toUpperCase();

  if (!nik || !name || !role) return { ok: false, message: "Data tidak lengkap" };
  if (!/^\d+$/.test(nik)) return { ok: false, message: "NIK harus angka" };
  if (role !== "ADMIN" && role !== "TECH") return { ok: false, message: "Role tidak valid" };

  const { data: existing, error: existingErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("nik", nik)
    .maybeSingle();

  if (existingErr) return { ok: false, message: existingErr.message };
  if (existing) return { ok: false, message: "NIK sudah terdaftar" };

  // bikin email dummy yang valid (supabase butuh email)
  const email = `${nik}@example.com`;
  const password = crypto.randomUUID();

  const { data: created, error: createUserErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createUserErr) return { ok: false, message: `createUser failed: ${createUserErr.message}` };

  const userId = created.user?.id;
  if (!userId) return { ok: false, message: "Auth user gagal dibuat (user.id kosong)" };

  const { error: insertErr } = await supabase.from("profiles").insert({
    id: userId,
    nik,
    name,
    role,
    active: true,
  });

  if (insertErr) {
    // rollback auth user kalau insert profile gagal
    await supabase.auth.admin.deleteUser(userId);
    return { ok: false, message: insertErr.message };
  }

  revalidatePath("/admin/users");
  return { ok: true, message: "User berhasil ditambahkan." };
}

export async function updateProfile(payload: {
  id: string;
  nik: string;
  name: string;
  role: "ADMIN" | "TECH";
}): Promise<ActionResult> {
  const supabase = supabaseAdmin();
  const { id, nik, name, role } = payload;

  if (!id) return { ok: false, message: "ID kosong" };
  if (!nik || !name || !role) return { ok: false, message: "Data tidak lengkap" };
  if (!/^\d+$/.test(nik)) return { ok: false, message: "NIK harus angka" };

  // cek duplikat nik (selain dirinya)
  const { data: dupe, error: dupeErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("nik", nik)
    .neq("id", id)
    .maybeSingle();

  if (dupeErr) return { ok: false, message: dupeErr.message };
  if (dupe) return { ok: false, message: "NIK sudah dipakai user lain" };

  // update email auth biar konsisten (optional)
  const newEmail = `${nik}@example.com`;
  const { error: authUpdErr } = await supabase.auth.admin.updateUserById(id, {
    email: newEmail,
    email_confirm: true,
  });
  if (authUpdErr) return { ok: false, message: `update auth user gagal: ${authUpdErr.message}` };

  const { error } = await supabase.from("profiles").update({ nik, name, role }).eq("id", id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/users");
  return { ok: true, message: "User berhasil diupdate." };
}

export async function toggleActive(payload: { id: string; active: boolean }): Promise<ActionResult> {
  const supabase = supabaseAdmin();
  const { id, active } = payload;

  if (!id) return { ok: false, message: "ID kosong" };

  const { error } = await supabase.from("profiles").update({ active }).eq("id", id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/users");
  return { ok: true, message: "Status user berhasil diubah." };
}

export async function deleteProfile(payload: { id: string }): Promise<ActionResult> {
  const supabase = supabaseAdmin();
  const { id } = payload;

  if (!id) return { ok: false, message: "ID kosong" };

  // FK profiles.id -> auth.users.id + ON DELETE CASCADE
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/users");
  return { ok: true, message: "User berhasil dihapus." };
}
