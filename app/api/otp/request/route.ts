import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { nik } = await req.json();
    if (!nik) {
      return NextResponse.json({ error: "NIK wajib" }, { status: 400 });
    }

    const supabase = createClient();

    // 1️⃣ Cari profile berdasarkan NIK
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, telegram_user_id, is_active")
      .eq("nik", nik)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 400 });
    }

    if (!profile.is_active) {
      return NextResponse.json({ error: "User tidak aktif" }, { status: 403 });
    }

    if (!profile.telegram_user_id) {
      return NextResponse.json({ error: "User belum connect Telegram" }, { status: 400 });
    }

    // 2️⃣ Generate OTP 6 digit
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 3️⃣ Insert ke tabel telegram_otps
    const { error: insertError } = await supabase.from("telegram_otps").insert({
      profile_id: profile.id,
      otp_code: otp,
      expired_at: new Date(Date.now() + 5 * 60 * 1000), // 5 menit
    });

    if (insertError) {
      return NextResponse.json({ error: "Gagal generate OTP" }, { status: 500 });
    }

    // 4️⃣ Kirim ke Telegram
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN belum diset" }, { status: 500 });
    }

    const tg = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: profile.telegram_user_id,
        text: `🔐 OTP Monitoring Alker:\n\n${otp}\n\nBerlaku 5 menit.`,
      }),
    });

    if (!tg.ok) {
      return NextResponse.json({ error: "Gagal kirim OTP Telegram" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
