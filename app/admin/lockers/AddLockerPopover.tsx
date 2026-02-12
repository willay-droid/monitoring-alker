"use client";

import * as React from "react";
import { createLocker } from "./actions";

function pad3(n: string) {
  return n.padStart(3, "0");
}

function toPreviewCode(input: string) {
  const raw = input.trim();
  if (!raw) return "";
  if (!/^\d{1,3}$/.test(raw)) return "";
  const num = Number(raw);
  if (Number.isNaN(num) || num < 1 || num > 999) return "";
  return `LOKER-${pad3(String(num))}`;
}

export default function AddLockerPopover() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string>("");
  const [ok, setOk] = React.useState<boolean>(false);

  const [lockerNumber, setLockerNumber] = React.useState("");
  const [name, setName] = React.useState("");
  const [location, setLocation] = React.useState("");

  const preview = toPreviewCode(lockerNumber);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setOk(false);

    const fd = new FormData();
    fd.set("locker_number", lockerNumber.trim()); // ✅ opsi A
    fd.set("name", name.trim());
    fd.set("location", location.trim());

    const res = await createLocker(fd);

    setLoading(false);
    setOk(!!res?.ok);
    setMsg(res?.message || "");

    if (res?.ok) {
      setLockerNumber("");
      setName("");
      setLocation("");
      // tutup popover setelah sukses (boleh komentar kalau mau tetap buka)
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
      >
        + Tambah Locker
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] rounded-2xl border bg-white p-4 shadow-lg">
          <div className="text-sm font-semibold">Tambah Locker</div>
          <div className="mt-1 text-xs text-gray-500">Input nomor saja, format akan otomatis.</div>

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700">Nomor</label>
              <input
                value={lockerNumber}
                onChange={(e) => setLockerNumber(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="Contoh: 2"
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
              <div className="mt-1 text-[11px] text-gray-500">
                {preview ? (
                  <>
                    Akan disimpan sebagai: <b>{preview}</b>
                  </>
                ) : (
                  "Range: 1–999"
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Nama</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Locker 02"
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Lokasi</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Contoh: Gudang / Indihome"
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </div>

            {msg && (
              <div className={`rounded-xl border px-3 py-2 text-xs ${ok ? "bg-green-50" : "bg-red-50"}`}>
                {msg}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border px-3 py-2 text-xs font-semibold"
                disabled={loading}
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                disabled={loading || !preview || !name.trim() || !location.trim()}
              >
                {loading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
