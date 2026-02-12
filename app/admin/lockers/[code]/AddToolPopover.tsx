"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createToolInLocker } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-3 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-60"
    >
      {pending ? "Menyimpan..." : "Simpan"}
    </button>
  );
}

export default function AddToolPopover({ lockerCode }: { lockerCode: string }) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <details
      ref={detailsRef}
      className="relative"
      onToggle={() => {
        // reset message tiap kali dibuka
        if (detailsRef.current?.open) setMsg(null);
      }}
    >
      <summary className="list-none cursor-pointer px-3 py-2 rounded-xl bg-black text-white text-sm hover:opacity-90">
        + Tambah Alat
      </summary>

      <div className="absolute right-0 mt-2 w-[360px] rounded-2xl border bg-white p-4 shadow-lg z-10">
        <div className="text-sm font-medium">Tambah Alat</div>
        <div className="text-xs text-gray-500 mb-3">Masuk ke locker {lockerCode}</div>

        {msg?.text ? (
          <div
            className={[
              "mb-3 rounded-xl border p-3 text-xs",
              msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700",
            ].join(" ")}
          >
            {msg.text}
          </div>
        ) : null}

        <form
          action={async (fd) => {
            setMsg(null);
            const res = await createToolInLocker(fd);

            if (!res?.ok) {
              setMsg({ ok: false, text: res?.message ?? "Gagal menambahkan alat." });
              return;
            }

            setMsg({ ok: true, text: res?.message ?? "Alat berhasil ditambahkan." });

            // close kalau sukses (biar UX enak)
            detailsRef.current?.removeAttribute("open");
          }}
          className="space-y-3"
        >
          <input type="hidden" name="lockerCode" value={lockerCode} />

          <div>
            <label className="text-xs text-gray-600">Nama Alat</label>
            <input
              name="name"
              placeholder="Contoh: Cleaver Fujikura"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="text-xs text-gray-600">Kategori</label>
            <input
              name="category"
              placeholder="Contoh: SPLICER / CLEAVER / OTDR"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="px-3 py-2 rounded-xl border bg-white text-sm"
              onClick={() => detailsRef.current?.removeAttribute("open")}
            >
              Batal
            </button>
            <SubmitButton />
          </div>
        </form>
      </div>
    </details>
  );
}
