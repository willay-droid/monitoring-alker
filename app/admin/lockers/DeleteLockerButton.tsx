"use client";

import { deleteLocker } from "./actions";

export default function DeleteLockerButton({ code }: { code: string }) {
  async function onDelete() {
    const ok = confirm(
      `Yakin hapus ${code}?\n\nLocker akan dinonaktifkan (soft delete).`
    );
    if (!ok) return;

    const fd = new FormData();
    fd.set("code", code);

    const res = await deleteLocker(fd);
    if (!res?.ok) {
      alert(res?.message || "Gagal menghapus locker.");
    }
  }

  return (
    <button
      onClick={onDelete}
      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
    >
      Hapus
    </button>
  );
}
