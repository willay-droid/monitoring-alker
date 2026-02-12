import { supabaseAdmin } from "@/lib/supabase/admin";

export async function validateNikOrThrow(nikInput: string) {
  const nik = String(nikInput ?? "").trim();

  if (!nik) throw new Error("NIK wajib diisi.");

  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("profiles")
    .select("nik, name, role, is_active")
    .eq("nik", nik)
    .maybeSingle();

  if (error) throw new Error(`Gagal validasi NIK: ${error.message}`);
  if (!data) throw new Error("NIK tidak terdaftar di database.");
  if (data.is_active === false) throw new Error("NIK terdaftar tapi tidak aktif.");

  return {
    nik: data.nik,
    name: data.name ?? "",
    role: data.role ?? "",
    is_active: data.is_active ?? true,
  };
}
