import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

function sign(payloadB64: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { nik, otp } = await req.json();
    if (!nik || !otp) return NextResponse.json({ error: "NIK & OTP wajib" }, { status: 400 });

    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, is_active")
      .eq("nik", nik)
      .single();

    if (!profile || !profile.is_active) return NextResponse.json({ error: "User tidak valid" }, { status: 403 });
    if (profile.role !== "ADMIN") return NextResponse.json({ error: "Bukan admin" }, { status: 403 });

    const { data: otpRow } = await supabase
      .from("telegram_otps")
      .select("id, expired_at, is_used")
      .eq("profile_id", profile.id)
      .eq("otp_code", String(otp))
      .eq("is_used", false)
      .gt("expired_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRow) return NextResponse.json({ error: "OTP salah / expired" }, { status: 400 });

    await supabase.from("telegram_otps").update({ is_used: true }).eq("id", otpRow.id);

    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret) return NextResponse.json({ error: "ADMIN_SESSION_SECRET belum diset" }, { status: 500 });

    const payload = {
      nik,
      role: "ADMIN",
      iat: Date.now(),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 hari
    };

    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sigHex = sign(payloadB64, secret);
    const cookieValue = `${payloadB64}.${sigHex}`;

    const res = NextResponse.json({ success: true, redirect: "/admin" });

    res.cookies.set("admin_session", cookieValue, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
