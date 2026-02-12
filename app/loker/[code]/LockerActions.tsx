"use client";

import React, { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "./actions";
import { checkoutAction, checkinAction } from "./actions";
import type { ToolRowLite } from "./page";

const initialState: ActionState = { ok: false, message: "" };

function Banner({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${state.ok ? "bg-green-50" : "bg-red-50"}`}>
      {state.message}
    </div>
  );
}

export default function LockerActions({
  code,
  status,
  tools,
}: {
  code: string;
  status: "AVAILABLE" | "IN_USE";
  tools: ToolRowLite[];
}) {
  const router = useRouter();

  const [checkoutState, checkoutFormAction, checkoutPending] = useActionState(checkoutAction, initialState);
  const [checkinState, checkinFormAction, checkinPending] = useActionState(checkinAction, initialState);

  // penting: untuk dispatch action di wrapper confirm
  const [isTransitionPending, startTransition] = useTransition();

  useEffect(() => {
    if (checkoutState.ok || checkinState.ok) router.refresh();
  }, [checkoutState.ok, checkinState.ok, router]);

  // === checkin + damaged tools UI
  const [hasDamage, setHasDamage] = useState(false);
  const [damageMap, setDamageMap] = useState<Record<number, { checked: boolean; note: string }>>({});

  const availableTools = useMemo(() => {
    return (tools ?? []).filter((t) => (t.status ?? "AVAILABLE").toUpperCase() !== "DAMAGED");
  }, [tools]);

  function toggleTool(id: number, checked: boolean) {
    setDamageMap((prev) => {
      const cur = prev[id] ?? { checked: false, note: "" };
      return { ...prev, [id]: { ...cur, checked } };
    });
  }

  function setToolNote(id: number, note: string) {
    setDamageMap((prev) => {
      const cur = prev[id] ?? { checked: false, note: "" };
      return { ...prev, [id]: { ...cur, note } };
    });
  }

  const damagedSelected = useMemo(() => {
    return Object.entries(damageMap)
      .map(([idStr, v]) => ({ id: Number(idStr), checked: v.checked, note: (v.note ?? "").trim() }))
      .filter((x) => x.checked);
  }, [damageMap]);

  const damageInvalid = useMemo(() => {
    if (!hasDamage) return false;
    if (damagedSelected.length === 0) return true;
    return damagedSelected.some((x) => !x.note);
  }, [hasDamage, damagedSelected]);

  const damagedNoteCombined = useMemo(() => {
    return damagedSelected.map((x) => `#${x.id}: ${x.note || "-"}`).join("; ");
  }, [damagedSelected]);

  useEffect(() => {
    if (checkinState.ok) {
      setHasDamage(false);
      setDamageMap({});
    }
  }, [checkinState.ok]);

  // ✅ wrapper action: confirm + dispatch dalam transition
  const checkoutActionWithConfirm = async (fd: FormData) => {
    const ok = window.confirm(
      "⚠️ Pastikan Anda berada di dekat alat fisik sebelum melakukan Checkout.\n\nJika tidak, klik Batal."
    );
    if (!ok) return;

    startTransition(() => {
      checkoutFormAction(fd);
    });
  };

  const checkoutDisabled =
    checkoutPending || isTransitionPending || status !== "AVAILABLE";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* CHECKOUT */}
      <div className="rounded-2xl border p-4">
        <div className="mb-1 font-semibold">Checkout</div>

        {/* ❌ jangan pakai onSubmit + preventDefault lagi */}
        <form action={checkoutActionWithConfirm} className="space-y-3">
          <input type="hidden" name="code" value={code} />
          <input
            name="nik"
            placeholder="NIK (angka)"
            className="w-full rounded-lg border px-3 py-2"
            inputMode="numeric"
            disabled={checkoutDisabled}
          />
          <button
            type="submit"
            disabled={checkoutDisabled}
            className="w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {checkoutDisabled ? "Memproses..." : "Checkout"}
          </button>
        </form>

        <Banner state={checkoutState} />
      </div>

      {/* CHECKIN + DAMAGE */}
      <div className="rounded-2xl border p-4">
        <div className="mb-1 font-semibold">Checkin</div>

        <form action={checkinFormAction} className="space-y-3">
          <input type="hidden" name="code" value={code} />

          <input type="hidden" name="damaged" value={hasDamage ? "1" : ""} />
          <input type="hidden" name="damaged_note" value={hasDamage ? damagedNoteCombined : ""} />
          {hasDamage
            ? damagedSelected.map((x) => (
                <input key={x.id} type="hidden" name="damaged_tool_ids" value={String(x.id)} />
              ))
            : null}

          <input
            name="nik"
            placeholder="NIK (angka)"
            className="w-full rounded-lg border px-3 py-2"
            inputMode="numeric"
            disabled={checkinPending || status !== "IN_USE"}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasDamage}
              onChange={(e) => setHasDamage(e.target.checked)}
              disabled={checkinPending || status !== "IN_USE"}
            />
            Ada alat rusak?
          </label>

          {hasDamage ? (
            <div className="rounded-xl border p-3">
              <div className="text-sm font-semibold">Pilih alat yang rusak</div>
              <div className="mt-1 text-xs text-gray-500">Centang alat yang rusak lalu isi catatan (wajib).</div>

              {availableTools.length === 0 ? (
                <div className="mt-3 text-sm text-gray-600">Tidak ada alat AVAILABLE untuk dicentang.</div>
              ) : (
                <div className="mt-3 space-y-3">
                  {availableTools.map((t) => {
                    const id = Number(t.id);
                    const checked = !!damageMap[id]?.checked;
                    const note = damageMap[id]?.note ?? "";

                    return (
                      <div key={id} className="rounded-xl border p-3">
                        <label className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{t.name ?? "-"}</div>
                            <div className="text-xs text-gray-500">{t.category ?? "-"}</div>
                          </div>

                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleTool(id, e.target.checked)}
                            disabled={checkinPending || status !== "IN_USE"}
                          />
                        </label>

                        {checked ? (
                          <div className="mt-2">
                            <textarea
                              value={note}
                              onChange={(e) => setToolNote(id, e.target.value)}
                              placeholder="Catatan kerusakan (wajib)..."
                              className="w-full rounded-lg border px-3 py-2 text-sm"
                              rows={2}
                              disabled={checkinPending || status !== "IN_USE"}
                            />
                            {!note.trim() ? <div className="mt-1 text-xs text-red-600">Catatan wajib diisi.</div> : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              {damageInvalid ? (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  Lengkapi: minimal 1 alat dicentang dan semua catatan wajib diisi.
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={checkinPending || status !== "IN_USE" || damageInvalid}
            className="w-full rounded-lg bg-gray-700 px-4 py-2 text-white disabled:opacity-50"
          >
            {checkinPending ? "Memproses..." : "Checkin"}
          </button>
        </form>

        <Banner state={checkinState} />
      </div>
    </div>
  );
}
