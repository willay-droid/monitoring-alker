"use client";

import { useState, useTransition } from "react";
import { createLocker } from "./actions";

export default function LockerAddButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  function reset() {
    setCode("");
    setName("");
    setLocation("");
    setErr(null);
  }

  function onSubmit() {
    setErr(null);

    startTransition(async () => {
      try {
        await createLocker({ code, name, location });
        reset();
        setOpen(false);
      } catch (e: any) {
        setErr(e?.message ?? "Gagal tambah locker.");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
      >
        + Tambah Locker
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Tambah Locker</div>
                <div className="mt-1 text-sm text-gray-500">
                  Isi kode unik (mis. LOKER-004), nama, dan lokasi.
                </div>
              </div>

              <button
                onClick={() => {
                  setOpen(false);
                  setErr(null);
                }}
                className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Kode</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="LOKER-004"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Nama</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Locker 04"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Lokasi</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Gudang / Indihome"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </div>

              {err ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {err}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setOpen(false);
                  setErr(null);
                }}
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                disabled={pending}
              >
                Batal
              </button>

              <button
                onClick={onSubmit}
                className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={pending}
              >
                {pending ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
