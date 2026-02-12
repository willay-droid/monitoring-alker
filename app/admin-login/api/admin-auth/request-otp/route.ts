import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { nik } = await req.json();
    if (!nik) return NextResponse.json({ error: "NIK wajib" }, { status: 400 });

    const supabase = createClient();

    // Admin only
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, role, is_active, telegram_user_id")
      .eq("nik", nik)
      .single();

    if (error || !profile) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 400 });
    if (!profile.is_active) return NextResponse.json({ error: "User nonaktif" }, { status: 403 });
    if (profile.role !== "ADMIN") return NextResponse.json({ error: "Bukan admin" }, { status: 403 });
    if (!profile.telegram_user_id) return NextResponse.json({ error: "Admin belum connect Telegram" }, { status: 400 });

    // OTP 6 digit
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Simpan OTP (5 menit)
    const { error: insErr } = await supabase.from("telegram_otps").insert({
      profile_id: profile.id,
      otp_code: otp,
      expired_at: new Date(Date.now() + 5 * 60 * 1000),
    });

    if (insErr) return NextResponse.json({ error: "Gagal buat OTP" }, { status: 500 });

    // Kirim ke Telegram
    const tg = await fetch(`https://api.telegram.org/bot${process.env.8367886171:AAEIaOcQ5Dp0Q6i4Pa8jbB3jl7aWXse8d3Q}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: profile.telegram_user_id,
        text: `🔐 OTP Login Admin Monitoring Alker\n\n${otp}\n\nBerlaku 5 menit.`,
      }),
    });

    if (!tg.ok) return NextResponse.json({ error: "Gagal kirim OTP Telegram" }, { status: 502 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
