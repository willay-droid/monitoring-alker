"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

export type ProfileRow = {
  id: string;
  nik: string;
  name: string;
  role: "ADMIN" | "TECH";
  active: boolean;
  created_at: string;
};

export async function listProfiles(): Promise<ProfileRow[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nik, name, role, active, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ProfileRow[];
}

export async function createProfile(formData: FormData) {
  const supabase = createAdminClient();

  const nik = String(formData.get("nik") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim().toUpperCase();

  if (!nik || !name || !role) throw new Error("Data tidak lengkap");
  if (!/^\d+$/.test(nik)) throw new Error("NIK harus angka");
  if (role !== "ADMIN" && role !== "TECH") throw new Error("Role tidak valid");

  const { data: existing, error: existingErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("nik", nik)
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);
  if (existing) throw new Error("NIK sudah terdaftar");

  const email = `${nik}@example.com`; // domain valid
  const password = crypto.randomUUID();

  const { data: created, error: createUserErr } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createUserErr) throw new Error(`createUser failed: ${createUserErr.message}`);

  const userId = created.user?.id;
  if (!userId) throw new Error("Auth user gagal dibuat (user.id kosong)");

  const { error: insertErr } = await supabase.from("profiles").insert({
    id: userId,
    nik,
    name,
    role,
    active: true,
  });

  if (insertErr) {
    await supabase.auth.admin.deleteUser(userId);
    throw new Error(insertErr.message);
  }

  revalidatePath("/admin/users");
}

export async function updateProfile(payload: {
  id: string;
  nik: string;
  name: string;
  role: "ADMIN" | "TECH";
}) {
  const supabase = createAdminClient();
  const { id, nik, name, role } = payload;

  if (!id) throw new Error("ID kosong");
  if (!nik || !name || !role) throw new Error("Data tidak lengkap");
  if (!/^\d+$/.test(nik)) throw new Error("NIK harus angka");

  // cek duplikat nik (selain dirinya)
  const { data: dupe, error: dupeErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("nik", nik)
    .neq("id", id)
    .maybeSingle();

  if (dupeErr) throw new Error(dupeErr.message);
  if (dupe) throw new Error("NIK sudah dipakai user lain");

  // update email auth biar konsisten (optional tapi bagus)
  const newEmail = `${nik}@example.com`;
  const { error: authUpdErr } = await supabase.auth.admin.updateUserById(id, {
    email: newEmail,
    email_confirm: true,
  });
  if (authUpdErr) throw new Error(`update auth user gagal: ${authUpdErr.message}`);

  const { error } = await supabase
    .from("profiles")
    .update({ nik, name, role })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}

export async function toggleActive(payload: { id: string; active: boolean }) {
  const supabase = createAdminClient();
  const { id, active } = payload;

  const { error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}

export async function deleteProfile(payload: { id: string }) {
  const supabase = createAdminClient();
  const { id } = payload;

  // FK profiles.id -> auth.users.id + ON DELETE CASCADE
  // jadi cukup delete auth user => profiles ikut kehapus
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}
