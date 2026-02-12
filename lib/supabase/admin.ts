import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function mustGetEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} belum di-set`);
  return v;
}

/**
 * Supabase Admin Client (Service Role)
 * HANYA untuk server-side
 */
export function supabaseAdmin(): SupabaseClient {
  const url = mustGetEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
