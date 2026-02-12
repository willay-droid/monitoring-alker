import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// OPTIONAL tapi sangat disaranin kalau kamu punya types supabase
// pastiin file ini ada (kalau belum ada, skip aja 2 baris ini dan hapus generic Database di bawah)
import type { Database } from "@/types/supabase";

/**
 * ✅ createClient(): dipakai page loker/history, route handler, dsb
 * Next 16: cookies() async -> WAJIB await
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL belum di-set");
  if (!anon) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY belum di-set");

  return createServerClient<Database>(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // beberapa konteks Server Component: cookies read-only
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
  });
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
