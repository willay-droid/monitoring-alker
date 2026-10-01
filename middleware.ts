import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function base64UrlDecodeToString(b64url: string) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return atob(b64 + pad);
}

async function verifyAdminSessionCookieSigned(value: string, secret: string) {
  const [payloadB64, sigHex] = value.split(".");
  if (!payloadB64 || !sigHex) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (hex !== sigHex) return false;

  let payload: any = null;
  try {
    payload = JSON.parse(base64UrlDecodeToString(payloadB64));
  } catch {
    return false;
  }

  if (!payload?.admin) return false;
  const exp = Number(payload?.exp || 0);
  if (!exp || Date.now() > exp) return false;

  return true;
}

async function sha256Hex(input: string) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyAdminSessionCookieDb(token: string) {
  const urlBase = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!urlBase || !serviceKey) return false;

  const tokenHash = await sha256Hex(token);
  const nowIso = new Date().toISOString();

  const restUrl =
    `${urlBase}/rest/v1/telegram_sessions` +
    `?select=id,expired_at,revoked_at,profiles:profile_id(role,is_active)` +
    `&session_token_hash=eq.${tokenHash}` +
    `&revoked_at=is.null` +
    `&expired_at=gt.${encodeURIComponent(nowIso)}` +
    `&limit=1`;

  const r = await fetch(restUrl, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    cache: "no-store",
  });

  if (!r.ok) return false;

  const rows = (await r.json()) as Array<any>;
  const sess = rows?.[0];

  return (
    !!sess &&
    sess.profiles?.is_active === true &&
    sess.profiles?.role === "ADMIN"
  );
}

async function verifyAnyAdminSession(cookieVal: string) {
  if (!cookieVal) return false;

  // Deklarasi dipindah ke ATAS sebelum pengecekan IF
  const secret = process.env.ADMIN_SESSION_SECRET || "";

  if (secret && cookieVal.includes(".")) {
    const ok = await verifyAdminSessionCookieSigned(cookieVal, secret);
    if (ok) return true;
  }

  if (!cookieVal.includes(".")) {
    const ok = await verifyAdminSessionCookieDb(cookieVal);
    if (ok) return true;
  }

  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ BYPASS API ROUTES
  if (pathname.startsWith("/api")) return NextResponse.next();

  // =========================================================================
  // 🔥 BLOK PENGECEKAN MAINTENANCE (CENTRAL COMMAND) 🔥
  // =========================================================================
  try {
    const edgeConfigId = process.env.EDGE_CONFIG_ID;
    const vercelToken = process.env.VERCEL_ACCESS_TOKEN;

    if (edgeConfigId && vercelToken) {
      const response = await fetch(
        `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
        {
          headers: {
            Authorization: `Bearer ${vercelToken}`,
          },
          cache: "no-store",
        },
      );

      if (response.ok) {
        const data = await response.json();

        // Cari status khusus untuk Monitoring Alker
        const alkerItem = data.find(
          (item: any) => item.key === "maintenance_alker",
        );

        if (
          alkerItem &&
          (alkerItem.value === true || alkerItem.value === "true")
        ) {
          return new NextResponse(
            `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Maintenance - Monitoring Alker</title>
              </head>
              <body style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; text-align:center; background-color:#111827; margin:0; overflow:hidden;">
                <div style="padding: 1rem; max-width: 85%;">
                  <h1 style="font-size:1.2rem; color:#f9fafb; margin-bottom: 0.5rem; white-space:nowrap;">🚧 Sedang Maintenance 🚧</h1>
                  <p style="color:#9ca3af; font-size:0.85rem; line-height:1.6;">Sistem Monitoring Alker sedang dalam perbaikan.<br>Silakan kembali beberapa saat lagi.</p>
                </div>
              </body>
            </html>
          `,
            {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            },
          );
        }
      }
    }
  } catch (error) {
    // Kalau Vercel API error, biarkan aplikasi tetap jalan normal (jangan sampai bikin down)
    console.error("Gagal cek status maintenance:", error);
  }
  // =========================================================================

  const cookieVal = req.cookies.get("admin_session")?.value || "";

  // ✅ kalau sudah login, buka /admin-login -> lempar ke /admin
  if (pathname === "/admin-login" || pathname.startsWith("/admin-login/")) {
    if (cookieVal) {
      const ok = await verifyAnyAdminSession(cookieVal);
      if (ok) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // ✅ protect /admin/*
  if (pathname.startsWith("/admin")) {
    if (!cookieVal) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin-login";
      return NextResponse.redirect(url);
    }

    const ok = await verifyAnyAdminSession(cookieVal);
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin-login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
