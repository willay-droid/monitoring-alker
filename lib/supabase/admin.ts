import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase"; // kalau belum punya, boleh hapus generic

function mustGetEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} belum di-set`);
  return v;
}

/**
 * ✅ Supabase Admin Client (Service Role)
 * - Bypass RLS
 * - HANYA untuk server-side
 * - Jangan pernah dipakai di client component
 */
export function supabaseAdmin(): SupabaseClient<Database> {
  const url = mustGetEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
