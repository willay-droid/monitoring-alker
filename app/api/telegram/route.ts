import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTelegramMessage } from "@/lib/telegram";

type TgUpdate = {
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string; last_name?: string };
    chat: { id: number; type: string };
    text?: string;
  };
};

type SessionRow = {
  telegram_user_id: number;
  flow: "add_teknisi" | "add_admin";
  step: "ASK_NIK" | "ASK_NAME";
  temp_nik: string | null;
  temp_name: string | null;
};

function getToken() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN belum diset");
  return t;
}

function isSuperAdmin(userId: number) {
  const raw = process.env.TELEGRAM_SUPERADMIN_IDS || "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
  return ids.includes(userId);
}

function onlyDigits(s: string) {
  return s.replace(/[^\d]/g, "");
}

function emailFromNik(nik: string) {
  return `nik_${nik}@monitoring-alker.local`;
}

function emailFromTelegram(userId: number) {
  return `tg_${userId}@monitoring-alker.local`;
}

function randomPassword(len = 16) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// cek admin dari profiles (role ADMIN + active true + telegram_user_id match)
async function isAdmin(sb: any, telegramUserId: number) {
  const { data } = await sb
    .from("profiles")
    .select("id")
    .eq("role", "ADMIN")
    .eq("telegram_user_id", telegramUserId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function upsertSession(sb: any, telegramUserId: number, patch: Partial<SessionRow>) {
  const { error } = await sb.from("telegram_sessions").upsert(
    { telegram_user_id: telegramUserId, ...patch },
    { onConflict: "telegram_user_id" }
  );
  if (error) throw new Error(error.message);
}

async function clearSession(sb: any, telegramUserId: number) {
  await sb.from("telegram_sessions").delete().eq("telegram_user_id", telegramUserId);
}

async function getSession(sb: any, telegramUserId: number) {
  const { data, error } = await sb
    .from("telegram_sessions")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as SessionRow | null;
}

async function createAuthUser(sb: any, email: string) {
  const password = randomPassword();
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  return { authId: data.user.id, tempPassword: password };
}

function adminSuccessMessage(nik: string) {
  return [
    "✅ Admin aktif.",
    "",
    `🔑 NIK login dashboard kamu: ${nik}`,
    "",
    "Cara login:",
    "1) Buka /admin-login",
    `2) Isi NIK: ${nik}`,
    "3) Klik 'Kirim OTP' → cek Telegram",
    "4) Masukkan OTP → masuk dashboard",
  ].join("\n");
}

async function handleCommand(sb: any, userId: number, chatId: number, text: string) {
  const cmd = text.trim().split(/\s+/)[0].toLowerCase();

  if (cmd === "/start" || cmd === "/menu") {
    await sendTelegramMessage(
      chatId,
      [
        "Menu Bot Monitoring Alker:",
        "",
        "• /add_teknisi — Untuk Registrasi",
        "• /cancel — Batalkan proses",
      ].join("\n")
    );
    return;
  }

  if (cmd === "/cancel") {
    await clearSession(sb, userId);
    await sendTelegramMessage(chatId, "✅ Proses dibatalkan.");
    return;
  }

  if (cmd === "/add_teknisi") {
    await upsertSession(sb, userId, { flow: "add_teknisi", step: "ASK_NIK", temp_nik: null, temp_name: null });
    await sendTelegramMessage(chatId, "Silakan masukkan NIK (angka):");
    return;
  }

  if (cmd === "/add_admin") {
    const allowed = isSuperAdmin(userId) || (await isAdmin(sb, userId));
    if (!allowed) {
      await clearSession(sb, userId);
      await sendTelegramMessage(chatId, "⛔ Anda tidak punya akses untuk menambah admin.");
      return;
    }

    await upsertSession(sb, userId, { flow: "add_admin", step: "ASK_NAME", temp_nik: null, temp_name: null });
    await sendTelegramMessage(chatId, "Silakan masukkan nama lengkap admin:");
    return;
  }

  await sendTelegramMessage(chatId, "Perintah tidak dikenal. Ketik /menu untuk lihat pilihan.");
}

async function handleFlow(sb: any, userId: number, chatId: number, text: string) {
  const s = await getSession(sb, userId);
  if (!s) {
    await sendTelegramMessage(chatId, "Ketik /menu untuk lihat perintah yang tersedia.");
    return;
  }

  // ===== ADD TEKNISI =====
  if (s.flow === "add_teknisi") {
    if (s.step === "ASK_NIK") {
      const nik = onlyDigits(text);
      if (nik.length < 4) {
        await sendTelegramMessage(chatId, "NIK tidak valid. Masukkan NIK angka (min 4 digit):");
        return;
      }

      const { data: exist, error: existErr } = await sb
        .from("profiles")
        .select("id")
        .eq("nik", nik)
        .limit(1)
        .maybeSingle();

      if (existErr) {
        await clearSession(sb, userId);
        await sendTelegramMessage(chatId, `❌ Gagal cek NIK: ${existErr.message}`);
        return;
      }

      if (exist) {
        await clearSession(sb, userId);
        await sendTelegramMessage(chatId, "⚠️ NIK sudah terdaftar. Jika ini salah, hubungi admin.");
        return;
      }

      await upsertSession(sb, userId, { step: "ASK_NAME", temp_nik: nik });
      await sendTelegramMessage(chatId, "Harap masukkan nama lengkap:");
      return;
    }

    if (s.step === "ASK_NAME") {
      const name = text.trim();
      if (name.length < 3) {
        await sendTelegramMessage(chatId, "Nama terlalu pendek. Masukkan nama lengkap:");
        return;
      }

      const nik = s.temp_nik;
      if (!nik) {
        await clearSession(sb, userId);
        await sendTelegramMessage(chatId, "Session error. Silakan ulangi /add_teknisi");
        return;
      }

      try {
        // buat auth user (FK aman)
        const { authId } = await createAuthUser(sb, emailFromNik(nik));

        const { error } = await sb.from("profiles").insert({
          id: authId,
          nik,
          name,
          role: "TECH",
          active: true,
        });

        await clearSession(sb, userId);

        if (error) {
          await sendTelegramMessage(chatId, `❌ Gagal simpan teknisi: ${error.message}`);
          return;
        }

        await sendTelegramMessage(chatId, "✅ Teknisi berhasil dibuat.");
      } catch (e: any) {
        await clearSession(sb, userId);
        await sendTelegramMessage(chatId, `❌ Gagal buat teknisi: ${e?.message ?? "unknown error"}`);
      }
      return;
    }
  }

  // ===== ADD ADMIN (self) =====
  if (s.flow === "add_admin") {
    if (s.step === "ASK_NAME") {
      const name = text.trim();
      if (name.length < 3) {
        await sendTelegramMessage(chatId, "Nama terlalu pendek. Masukkan nama lengkap admin:");
        return;
      }

      try {
        // kalau telegram user udah punya profile -> update role jadi ADMIN
        const { data: existing, error: findErr } = await sb
          .from("profiles")
          .select("id, nik")
          .eq("telegram_user_id", userId)
          .maybeSingle();

        if (findErr) {
          await clearSession(sb, userId);
          await sendTelegramMessage(chatId, `❌ Gagal cek admin: ${findErr.message}`);
          return;
        }

        if (existing?.id) {
          const nikToUse = existing.nik ?? `ADM-${userId}`;

          const { error: updErr } = await sb
            .from("profiles")
            .update({
              name,
              role: "ADMIN",
              active: true,
              nik: nikToUse,
            })
            .eq("id", existing.id);

          await clearSession(sb, userId);

          if (updErr) {
            await sendTelegramMessage(chatId, `❌ Gagal update admin: ${updErr.message}`);
            return;
          }

          await sendTelegramMessage(chatId, adminSuccessMessage(nikToUse));
          return;
        }

        // kalau belum punya profile, buat auth user + insert profile admin
        const nikToUse = `ADM-${userId}`;
        const { authId } = await createAuthUser(sb, emailFromTelegram(userId));

        const { error: insErr } = await sb.from("profiles").insert({
          id: authId,
          nik: nikToUse,
          telegram_user_id: userId,
          name,
          role: "ADMIN",
          active: true,
        });

        await clearSession(sb, userId);

        if (insErr) {
          await sendTelegramMessage(chatId, `❌ Gagal simpan admin: ${insErr.message}`);
          return;
        }

        await sendTelegramMessage(chatId, adminSuccessMessage(nikToUse));
        return;
      } catch (e: any) {
        await clearSession(sb, userId);
        await sendTelegramMessage(chatId, `❌ Gagal buat admin: ${e?.message ?? "unknown error"}`);
        return;
      }
    }
  }

  await clearSession(sb, userId);
  await sendTelegramMessage(chatId, "Session tidak dikenal. Ketik /menu untuk mulai lagi.");
}

export async function POST(req: Request) {
  getToken();

  const body = (await req.json().catch(() => null)) as TgUpdate | null;
  const msg = body?.message;
  const userId = msg?.from?.id;
  const chatId = msg?.chat?.id;
  const text = msg?.text ?? "";

  if (!msg || !userId || !chatId || !text) return NextResponse.json({ ok: true });

  const sb = supabaseAdmin();

  if (text.trim().startsWith("/")) {
    await handleCommand(sb, userId, chatId, text);
    return NextResponse.json({ ok: true });
  }

  await handleFlow(sb, userId, chatId, text);
  return NextResponse.json({ ok: true });
}
