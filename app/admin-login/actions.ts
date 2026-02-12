"use server";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTelegramMessage } from "@/lib/telegram";

type Result = { ok: boolean; message: string };

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hmacSign(input: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(input).digest("hex");
}

function makeOtp6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getTtlSeconds() {
  return Number(process.env.ADMIN_OTP_TTL_SECONDS || 300); // default 5 menit
}

function getMinIntervalSeconds() {
  return Number(process.env.ADMIN_OTP_MIN_INTERVAL_SECONDS || 30); // default 30 detik
}

function getSessionSecret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("ADMIN_SESSION_SECRET belum diset / terlalu pendek");
  return s;
}

// cookie value: base64url(payload).signatureHex
function createSessionCookie(payloadObj: any) {
  const secret = getSessionSecret();
  const payload = JSON.stringify(payloadObj);
  const b64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = hmacSign(b64, secret);
  return `${b64}.${sig}`;
}

async function getAdminProfileByNik(nik: string) {
  const sb = supabaseAdmin();

  const { data: profile, error } = await sb
    .from("profiles")
    .select("id, nik, role, is_active, telegram_user_id, name")
    .eq("nik", nik)
    .single();

  if (error || !profile) return { ok: false as const, message: "User tidak ditemukan." };
  if (!profile.is_active) return { ok: false as const, message: "User nonaktif." };
  if (profile.role !== "ADMIN") return { ok: false as const, message: "Akun ini bukan ADMIN." };
  if (!profile.telegram_user_id) return { ok: false as const, message: "Admin belum connect Telegram (telegram_user_id kosong)." };

  return { ok: true as const, profile };
}

/**
 * REQUEST OTP (berdasarkan NIK admin)
 * Dipanggil dari form: fd berisi "nik"
 */
export async function requestAdminOtp(fd: FormData): Promise<Result> {
  const nik = String(fd.get("nik") ?? "").trim();
  if (!nik) return { ok: false, message: "NIK wajib diisi." };

  const ttl = getTtlSeconds();
  const minInterval = getMinIntervalSeconds();

  const found = await getAdminProfileByNik(nik);
  if (!found.ok) return { ok: false, message: found.message };

  const { profile } = found;
  const sb = supabaseAdmin();

  // rate limit: cek OTP terakhir (berdasarkan profile_id)
  const { data: last } = await sb
    .from("telegram_otps")
    .select("created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last?.created_at) {
    const lastAt = new Date(last.created_at).getTime();
    const diffSec = (Date.now() - lastAt) / 1000;
    if (diffSec < minInterval) {
      return { ok: false, message: `Tunggu ${Math.ceil(minInterval - diffSec)} detik lalu coba lagi.` };
    }
  }

  const otp = makeOtp6();
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  // simpan OTP (pakai table telegram_otps yang sudah ada)
  const { error: insErr } = await sb.from("telegram_otps").insert({
    profile_id: profile.id,
    otp_code: otp,
    expired_at: expiresAt,
  });

  if (insErr) return { ok: false, message: `Gagal simpan OTP: ${insErr.message}` };

  try {
    await sendTelegramMessage(Number(profile.telegram_user_id), `🔐 OTP Admin: ${otp}\nBerlaku ${ttl} detik.\nNIK: ${nik}`);
  } catch (e: any) {
    return { ok: false, message: `Gagal kirim OTP Telegram: ${e?.message || "unknown"}` };
  }

  return { ok: true, message: "OTP sudah dikirim ke Telegram admin." };
}

/**
 * VERIFY OTP (berdasarkan NIK admin + otp)
 * fd berisi: "nik" dan "otp"
 */
export async function verifyAdminOtp(fd: FormData): Promise<Result> {
  const nik = String(fd.get("nik") ?? "").trim();
  const code = String(fd.get("otp") ?? "").trim();

  if (!nik) return { ok: false, message: "NIK wajib diisi." };
  if (!/^\d{6}$/.test(code)) return { ok: false, message: "OTP harus 6 digit angka." };

  const found = await getAdminProfileByNik(nik);
  if (!found.ok) return { ok: false, message: found.message };

  const { profile } = found;
  const sb = supabaseAdmin();

  // ambil OTP terbaru yang belum dipakai & belum expired
  const { data: row, error } = await sb
    .from("telegram_otps")
    .select("id, otp_code, expired_at, is_used, created_at")
    .eq("profile_id", profile.id)
    .eq("is_used", false)
    .gt("expired_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!row) return { ok: false, message: "OTP tidak ditemukan / expired. Klik 'Kirim OTP' dulu." };

  if (String(row.otp_code) !== code) {
    // (opsional) bisa bikin OTP tetap valid sampai benar,
    // tapi demi keamanan, kita biarin user request OTP ulang kalau salah.
    return { ok: false, message: "OTP salah." };
  }

  // mark used
  await sb.from("telegram_otps").update({ is_used: true }).eq("id", row.id);

  // set session cookie 7 hari (format cocok dengan middleware lo)
  const expSession = Date.now() + 7 * 24 * 3600 * 1000;
  const cookieVal = createSessionCookie({
    admin: true,
    nik,
    pid: profile.id,
    exp: expSession,
  });

  const jar = await cookies();
  jar.set("admin_session", cookieVal, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });

  return { ok: true, message: "Login admin sukses." };
}

export async function adminLogout(): Promise<void> {
  const jar = await cookies();
  jar.set("admin_session", "", { path: "/", maxAge: 0 });
}
