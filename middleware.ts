// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function base64UrlDecodeToString(b64url: string) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return atob(b64 + pad);
}

async function verifyAdminSessionCookieSigned(value: string, secret: string) {
  // format: payloadB64.sigHex
  const [payloadB64, sigHex] = value.split(".");
  if (!payloadB64 || !sigHex) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
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
  // token ini versi baru: random hex tanpa "."
  const urlBase = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!urlBase || !serviceKey) return false;

  const tokenHash = await sha256Hex(token);
  const nowIso = new Date().toISOString();

  // NOTE:
  // Pastikan tabel telegram_sessions punya:
  // - session_token_hash (text)
  // - expired_at (timestamptz)
  // - revoked_at (timestamptz nullable)
  // - profile_id (uuid FK -> profiles)
  //
  // dan profiles punya role/is_active
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

  // 1) Coba verifikasi versi lama (signed payload.sig)
  const secret = process.env.ADMIN_SESSION_SECRET || "";
  if (secret && cookieVal.includes(".")) {
    const ok = await verifyAdminSessionCookieSigned(cookieVal, secret);
    if (ok) return true;
  }

  // 2) Coba verifikasi versi baru (token random -> cek DB)
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
