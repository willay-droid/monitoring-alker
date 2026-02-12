"use client";

import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteTool, updateTool } from "./actions";

type ToolRow = {
  id: number;
  name: string | null;
  category: string | null;
  status: string | null;
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

export default function ToolsCrudClient({
  lockerCode,
  tools,
}: {
  lockerCode: string;
  tools: ToolRow[];
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const current = useMemo(
    () => tools.find((t) => t.id === openId) ?? null,
    [openId, tools]
  );

  const dialogRef = useRef<HTMLDialogElement | null>(null);

  function openEdit(id: number) {
    setErrMsg(null);
    setOpenId(id);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
    setOpenId(null);
    setErrMsg(null);
  }

  return (
    <>
      {/* Modal Edit */}
      <dialog ref={dialogRef} className="rounded-2xl p-0 backdrop:bg-black/30">
        <div className="w-[420px] max-w-[92vw] p-4">
          <div className="text-sm font-medium">Edit Alat</div>
          <div className="text-xs text-gray-500 mb-3">Locker: {lockerCode}</div>

          {errMsg ? (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {errMsg}
            </div>
          ) : null}

          {current ? (
            <form
              action={async (fd) => {
                setErrMsg(null);
                const res = await updateTool(fd);
                if (!res?.ok) {
                  setErrMsg(res?.message ?? "Gagal update.");
                  return;
                }
                close();
              }}
              className="space-y-3"
            >
              <input type="hidden" name="lockerCode" value={lockerCode} />
              <input type="hidden" name="toolId" value={current.id} />

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
                <label className="text-xs text-gray-600">Kategori</label>
                <input
                  name="category"
                  defaultValue={current.category ?? ""}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-gray-600">Status</label>
                <select
                  name="status"
                  defaultValue={(current.status ?? "AVAILABLE").toUpperCase()}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm bg-white"
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="IN_USE">IN_USE</option>
                  <option value="DAMAGED">DAMAGED</option>
                </select>
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
            <div className="text-sm text-gray-600">Data tidak ditemukan.</div>
          )}
        </div>
      </dialog>

      {/* Buttons row */}
      <div className="flex items-center justify-end gap-2">
        {/* kosong - tombol per row di-render dari parent */}
      </div>

      {/* helper renderer dipakai di page.tsx */}
      <style jsx global>{`
        dialog::backdrop {
          background: rgba(0, 0, 0, 0.3);
        }
      `}</style>

      {/* Expose actions via window? nggak perlu */}
      {/* tombol per row akan memanggil openEdit + form delete */}
      <div className="hidden" />
    </>
  );
}

export function ToolRowActions({
  lockerCode,
  toolId,
  onEdit,
}: {
  lockerCode: string;
  toolId: number;
  onEdit: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-end gap-2">
      {err ? <span className="text-xs text-red-600">{err}</span> : null}

      <button
        type="button"
        className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
        onClick={onEdit}
      >
        Edit
      </button>

      <form
        action={async (fd) => {
          setErr(null);
          const ok = confirm("Yakin hapus alat ini?");
          if (!ok) return;
          const res = await deleteTool(fd);
          if (!res?.ok) setErr(res?.message ?? "Gagal hapus.");
        }}
      >
        <input type="hidden" name="lockerCode" value={lockerCode} />
        <input type="hidden" name="toolId" value={toolId} />
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
