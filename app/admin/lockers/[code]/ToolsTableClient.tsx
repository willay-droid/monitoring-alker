"use client";

import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteTool, updateTool, markToolFixed } from "./actions";

export type ToolRow = {
  id: number;
  name: string | null;
  category: string | null;
  status: string | null; // AVAILABLE | DAMAGED
};

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toUpperCase();
  const cls =
    s === "AVAILABLE"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s === "DAMAGED"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-gray-50 text-gray-700 border-gray-200";

  return <span className={`text-xs px-2 py-1 rounded-full border ${cls}`}>{s || "—"}</span>;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="px-3 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-60">
      {pending ? "Menyimpan..." : label}
    </button>
  );
}

function RowSubmitButton({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? "..." : label}
    </button>
  );
}

export default function ToolsTableClient({ lockerCode, tools }: { lockerCode: string; tools: ToolRow[] }) {
  const [editId, setEditId] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<number, string | null>>({});
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const current = useMemo(() => tools.find((t) => t.id === editId) ?? null, [editId, tools]);

  function openEdit(id: number) {
    setEditError(null);
    setEditId(id);
    dialogRef.current?.showModal();
  }

  function closeEdit() {
    dialogRef.current?.close();
    setEditId(null);
    setEditError(null);
  }

  return (
    <>
      {/* Modal Edit */}
      <dialog ref={dialogRef} className="rounded-2xl p-0 backdrop:bg-black/30">
        <div className="w-[420px] max-w-[92vw] p-4">
          <div className="text-sm font-medium">Edit Alat</div>
          <div className="text-xs text-gray-500 mb-3">Locker: {lockerCode}</div>

          {editError ? (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{editError}</div>
          ) : null}

          {current ? (
            <form
              action={async (fd) => {
                setEditError(null);
                const res = await updateTool(fd);
                if (!res?.ok) {
                  setEditError(res?.message ?? "Gagal update.");
                  return;
                }
                closeEdit();
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
                  <option value="DAMAGED">DAMAGED</option>
                </select>
                <div className="mt-1 text-[11px] text-gray-500">Catatan: IN_USE adalah status locker, bukan tool.</div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="px-3 py-2 rounded-xl border bg-white text-sm" onClick={closeEdit}>
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr className="text-left">
              <th className="py-3 px-4">Nama Alat</th>
              <th className="py-3 px-4">Kategori</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>

          <tbody>
            {tools.length === 0 ? (
              <tr>
                <td className="py-6 px-4 text-gray-500" colSpan={4}>
                  Belum ada alat di locker ini.
                </td>
              </tr>
            ) : (
              tools.map((t) => {
                const isDamaged = (t.status ?? "").toUpperCase() === "DAMAGED";
                return (
                  <tr key={t.id} className="border-t hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{t.name ?? "-"}</td>
                    <td className="py-3 px-4 text-gray-600">{t.category ?? "-"}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {rowError[t.id] ? <span className="text-xs text-red-600">{rowError[t.id]}</span> : null}

                        {isDamaged ? (
                          <form
                            action={async (fd) => {
                              setRowError((p) => ({ ...p, [t.id]: null }));
                              const res = await markToolFixed(fd);
                              if (!res?.ok) {
                                setRowError((p) => ({ ...p, [t.id]: res?.message ?? "Gagal mark fixed." }));
                              }
                            }}
                          >
                            <input type="hidden" name="lockerCode" value={lockerCode} />
                            <input type="hidden" name="toolId" value={t.id} />
                            <RowSubmitButton
                              label="Mark Fixed"
                              className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm"
                            />
                          </form>
                        ) : null}

                        <button
                          type="button"
                          className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
                          onClick={() => openEdit(t.id)}
                        >
                          Edit
                        </button>

                        <form
                          action={async (fd) => {
                            setRowError((p) => ({ ...p, [t.id]: null }));
                            const ok = confirm(`Yakin hapus alat: "${t.name ?? "-"}"?`);
                            if (!ok) return;

                            const res = await deleteTool(fd);
                            if (!res?.ok) {
                              setRowError((p) => ({ ...p, [t.id]: res?.message ?? "Gagal hapus." }));
                            }
                          }}
                        >
                          <input type="hidden" name="lockerCode" value={lockerCode} />
                          <input type="hidden" name="toolId" value={t.id} />
                          <RowSubmitButton
                            label="Hapus"
                            className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-sm"
                          />
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
