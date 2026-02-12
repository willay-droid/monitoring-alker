export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requestAdminOtp, verifyAdminOtp, adminLogout } from "./actions";

function getParam(
  sp: Record<string, string | string[] | undefined>,
  key: string
) {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const sp = searchParams ?? {};

  // ✅ robust: handle string | string[]
  const error = getParam(sp, "error");
  const info = getParam(sp, "info");
  const nikPrefill = getParam(sp, "nik");

  const nikHasError =
    !!error &&
    /nik|admin|user|tidak ditemukan|not found/i.test(error);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white p-5 space-y-4">
        <div>
          <div className="text-xs text-gray-500">ADMIN LOGIN</div>
          <h1 className="text-2xl font-semibold">OTP Telegram</h1>
          <p className="text-sm text-gray-500 mt-1">
            Masukkan NIK Admin → Kirim OTP → masukkan OTP → Masuk dashboard.
          </p>
        </div>

        {info ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {info}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <div className="font-semibold">Gagal</div>
            <div className="mt-1">{error}</div>
          </div>
        ) : null}

        {/* ✅ SATU FORM: NIK + OTP */}
        <form className="space-y-3">
          <div>
            <label htmlFor="nik" className="text-xs text-gray-600">
              NIK Admin
            </label>
            <input
              id="nik"
              name="nik"
              defaultValue={nikPrefill}
              placeholder="contoh: ADM-669911745"
              className={[
                "mt-1 w-full rounded-xl border px-3 py-2",
                nikHasError ? "border-red-300 focus:border-red-400 focus:ring-red-200" : "",
              ].join(" ")}
              required
            />
            {nikHasError ? (
              <div className="mt-1 text-xs text-red-600">
                Cek kembali NIK admin yang terdaftar.
              </div>
            ) : null}
          </div>

          <button
            formAction={async (fd) => {
              "use server";
              const nik = String(fd.get("nik") ?? "").trim();
              if (!nik) {
                redirect(
                  `/admin-login?error=${encodeURIComponent("NIK wajib diisi.")}`
                );
              }

              const res = await requestAdminOtp(fd);
              if (!res.ok) {
                redirect(
                  `/admin-login?nik=${encodeURIComponent(
                    nik
                  )}&error=${encodeURIComponent(res.message)}`
                );
              }
              redirect(
                `/admin-login?nik=${encodeURIComponent(
                  nik
                )}&info=${encodeURIComponent(res.message)}`
              );
            }}
            className="w-full rounded-xl bg-black text-white py-2 text-sm hover:opacity-90"
          >
            Kirim OTP ke Telegram
          </button>

          <div>
            <label htmlFor="otp" className="text-xs text-gray-600">
              OTP (6 digit)
            </label>
            <input
              id="otp"
              name="otp"
              inputMode="numeric"
              placeholder="123456"
              className="mt-1 w-full rounded-xl border px-3 py-2"
              // ❗ jangan required, biar tombol "Kirim OTP" tetap bisa dipakai tanpa isi OTP
            />
          </div>

          <button
            formAction={async (fd) => {
              "use server";
              const nik = String(fd.get("nik") ?? "").trim();
              if (!nik) {
                redirect(
                  `/admin-login?error=${encodeURIComponent(
                    "Isi NIK dulu lalu kirim OTP."
                  )}`
                );
              }

              const res = await verifyAdminOtp(fd);
              if (!res.ok) {
                redirect(
                  `/admin-login?nik=${encodeURIComponent(
                    nik
                  )}&error=${encodeURIComponent(res.message)}`
                );
              }
              redirect("/admin");
            }}
            className="w-full rounded-xl bg-gray-800 text-white py-2 text-sm hover:opacity-90"
          >
            Verifikasi & Masuk
          </button>
        </form>

        {/* Logout */}
        <form
          action={async () => {
            "use server";
            await adminLogout();
            redirect(
              "/admin-login?info=" + encodeURIComponent("Logout sukses.")
            );
          }}
        >
          <button className="w-full rounded-xl border py-2 text-sm hover:bg-gray-50">
            Logout (hapus cookie)
          </button>
        </form>

        <div className="text-xs text-gray-500">
          Pastikan admin sudah pernah chat bot dan klik <b>/start</b>, kalau tidak OTP tidak bisa dikirim.
        </div>
      </div>
    </div>
  );
}
