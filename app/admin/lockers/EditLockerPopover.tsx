"use client";

import * as React from "react";
import { updateLocker } from "./actions";

type Props = {
  code: string;
  name: string | null;
  location: string | null;
};

export default function EditLockerPopover({ code, name, location }: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [ok, setOk] = React.useState(false);

  const [newName, setNewName] = React.useState(name ?? "");
  const [newLocation, setNewLocation] = React.useState(location ?? "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setOk(false);

    const fd = new FormData();
    fd.set("originalCode", code);
    fd.set("code", code); // kode dikunci
    fd.set("name", newName.trim());
    fd.set("location", newLocation.trim());

    const res = await updateLocker(fd);

    setLoading(false);
    setOk(!!res?.ok);
    setMsg(res?.message || "");

    if (res?.ok) {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-gray-50"
      >
        Edit
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[340px] rounded-2xl border bg-white p-4 shadow-lg">
          <div className="text-sm font-semibold">Edit Locker</div>
          <div className="mt-1 text-xs text-gray-500">
            Kode dikunci: <b>{code}</b>
          </div>

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium">Nama</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </div>

            <div>
              <label className="text-xs font-medium">Lokasi</label>
              <input
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </div>

            {msg && (
              <div
                className={`rounded-xl border px-3 py-2 text-xs ${
                  ok ? "bg-green-50" : "bg-red-50"
                }`}
              >
                {msg}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border px-3 py-2 text-xs"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white"
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
