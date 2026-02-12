import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * ✅ createClient(): dipakai page loker/history, route handler, dsb
 * Next 16: cookies() itu async -> WAJIB await
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // di beberapa konteks Server Component, cookies bisa read-only
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // read-only context
          }
        },
      },
    }
  ) as unknown as SupabaseClient;
}

/**
 * ✅ createAdminClient(): untuk bypass RLS (service role)
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL belum di-set");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum di-set");

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
