"use client";

import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteLocker, updateLocker } from "./actions";

export type LockerRow = {
  code: string;
  name: string | null;
  location: string | null;
  total?: number | null;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-3 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-60"
    >
      {pending ? "Menyimpan..." : label}
    </button>
  );
}

export default function LockersCrudClient({ lockers }: { lockers: LockerRow[] }) {
  const [editCode, setEditCode] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const current = useMemo(
    () => lockers.find((l) => l.code === editCode) ?? null,
    [editCode, lockers]
  );

  function openEdit(code: string) {
    setErrMsg(null);
    setEditCode(code);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
    setEditCode(null);
    setErrMsg(null);
  }

  return (
    <>
      <dialog ref={dialogRef} className="rounded-2xl p-0 backdrop:bg-black/30">
        <div className="w-[460px] max-w-[92vw] p-4">
          <div className="text-sm font-medium">Edit Locker</div>

          {errMsg ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {errMsg}
            </div>
          ) : null}

          {current ? (
            <form
              className="mt-4 space-y-3"
              action={async (fd) => {
                setErrMsg(null);
                const res = await updateLocker(fd);
                if (!res?.ok) {
                  setErrMsg(res?.message ?? "Gagal update.");
                  return;
                }
                close();
              }}
            >
              <input type="hidden" name="originalCode" value={current.code} />

              <div>
                <label className="text-xs text-gray-600">Kode</label>
                <input
                  name="code"
                  defaultValue={current.code}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-gray-600">Nama</label>
                <input
                  name="name"
                  defaultValue={current.name ?? ""}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-gray-600">Lokasi</label>
                <input
                  name="location"
                  defaultValue={current.location ?? ""}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl border bg-white text-sm"
                  onClick={close}
                >
                  Batal
                </button>
                <SubmitButton label="Update" />
              </div>
            </form>
          ) : (
            <div className="mt-4 text-sm text-gray-600">Data tidak ditemukan.</div>
          )}
        </div>
      </dialog>

      {/* helper styles */}
      <style jsx global>{`
        dialog::backdrop {
          background: rgba(0, 0, 0, 0.3);
        }
      `}</style>

      {/* tombol action per row akan dipanggil dari page */}
      <div className="hidden" />
    </>
  );
}

export function LockerRowActions({ code, total }: { code: string; total?: number | null }) {
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-end gap-2">
      {err ? <span className="text-xs text-red-600">{err}</span> : null}

      <button
        type="button"
        className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
        onClick={() => {
          // event biar page bisa buka modal (simple & aman)
          window.dispatchEvent(new CustomEvent("open-edit-locker", { detail: code }));
        }}
      >
        Edit
      </button>

      <form
        action={async (fd) => {
          setErr(null);

          // proteksi UI tambahan (opsional): kalau total>0, kasih warning
          const msg =
            (total ?? 0) > 0
              ? `Locker masih punya ${total} alat. Hapus alat dulu. Lanjut hapus locker?`
              : "Yakin hapus locker ini?";

          const ok = confirm(msg);
          if (!ok) return;

          const res = await deleteLocker(fd);
          if (!res?.ok) setErr(res?.message ?? "Gagal hapus.");
        }}
      >
        <input type="hidden" name="code" value={code} />
        <button
          type="submit"
          className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-sm"
        >
          Hapus
        </button>
      </form>
    </div>
  );
}
