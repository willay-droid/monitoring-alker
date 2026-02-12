import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { nik, otp } = await req.json();
    if (!nik || !otp) return NextResponse.json({ error: "NIK & OTP wajib" }, { status: 400 });

    const supabase = await createClient();

    // Ambil admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, is_active")
      .eq("nik", nik)
      .single();

    if (!profile || !profile.is_active) return NextResponse.json({ error: "User tidak valid" }, { status: 403 });
    if (profile.role !== "ADMIN") return NextResponse.json({ error: "Bukan admin" }, { status: 403 });

    // Validasi OTP terbaru yang belum dipakai & belum expired
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

    // Tandai OTP used
    await supabase.from("telegram_otps").update({ is_used: true }).eq("id", otpRow.id);

    // Buat session token random -> simpan hash-nya aja ke DB
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const sessionTokenHash = sha256(sessionToken);

    const expiredAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 hari

    const { error: sessErr } = await supabase.from("telegram_sessions").insert({
      profile_id: profile.id,
      session_token_hash: sessionTokenHash,
      expired_at: expiredAt.toISOString(),
    });

    if (sessErr) return NextResponse.json({ error: "Gagal buat session" }, { status: 500 });

    // Set cookie httpOnly
    const res = NextResponse.json({ success: true });
    res.cookies.set("admin_session", sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      expires: expiredAt,
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
