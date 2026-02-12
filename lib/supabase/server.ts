import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function mustGetEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} belum di-set`);
  return v;
}

/**
 * ✅ createClient(): untuk Server Components / Route Handlers yang butuh session cookies
 * Next 16: cookies() async -> WAJIB await
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  const url = mustGetEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustGetEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Component bisa read-only cookie store (normal)
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          // read-only context
        }
      },
    },
  });
}
