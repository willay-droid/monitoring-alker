"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React from "react";

export type LockerHistoryRow = {
  id: string;
  nik: string;
  action: string;
  toolCount: number;
  createdAt: string;
  note?: string | null;
};

function formatTanggal(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

function buildHref(pathname: string, sp: URLSearchParams, patch: Record<string, string>) {
  const next = new URLSearchParams(sp?.toString?.() ? sp.toString() : "");
  Object.entries(patch).forEach(([k, v]) => next.set(k, v));
  const base = pathname || "";
  return `${base}?${next.toString()}`;
}

export default function LockerHistoryClient({
  lockerCode,
  rows,
  total,
  page,
  perPage,
  order,
}: {
  lockerCode: string;
  rows: LockerHistoryRow[];
  total: number;
  page: number;
  perPage: 50 | 100;
  order: "asc" | "desc";
}) {
  const pathname = usePathname() || "";
  const spRaw = useSearchParams();
  const sp = spRaw ? new URLSearchParams(spRaw.toString()) : new URLSearchParams();

  const totalPages = Math.max(1, Math.ceil((total || 0) / perPage));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const toggleOrder = order === "asc" ? "desc" : "asc";
  const downloadHref = `/api/admin/lockers/${encodeURIComponent(lockerCode)}/history-xlsx?order=${encodeURIComponent(
    order
  )}`;

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="p-4 border-b flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">History Locker</div>
          <div className="text-xs text-gray-500">Menampilkan history checkout/checkin di locker {lockerCode}.</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-gray-500 mr-1">Per page:</div>

          <Link
            href={buildHref(pathname, sp, { perPage: "50", page: "1" })}
            className={`px-3 py-2 rounded-xl border text-sm ${
              perPage === 50 ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"
            }`}
          >
            50
          </Link>
          <Link
            href={buildHref(pathname, sp, { perPage: "100", page: "1" })}
            className={`px-3 py-2 rounded-xl border text-sm ${
              perPage === 100 ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"
            }`}
          >
            100
          </Link>

          <a href={downloadHref} className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm">
            Download XLSX
          </a>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr className="border-b">
              <th className="text-left font-medium px-4 py-3 w-[64px]">No</th>
              <th className="text-left font-medium px-4 py-3">NIK</th>
              <th className="text-left font-medium px-4 py-3">Aksi</th>
              <th className="text-left font-medium px-4 py-3">Jumlah Alat</th>

              <th className="text-left font-medium px-4 py-3 whitespace-nowrap">
                <Link
                  href={buildHref(pathname, sp, { order: toggleOrder, page: "1" })}
                  className="inline-flex items-center gap-2 hover:underline"
                  title="Sort tanggal"
                >
                  Tanggal
                  <span className="text-xs px-2 py-0.5 rounded-lg border bg-white">{order.toUpperCase()}</span>
                </Link>
              </th>

              <th className="text-left font-medium px-4 py-3">Note</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={6}>
                  Belum ada history.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={`${r.id}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{(page - 1) * perPage + idx + 1}</td>
                  <td className="px-4 py-3">{r.nik}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-lg border bg-white text-xs">{r.action}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">{r.toolCount}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatTanggal(r.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-700">{r.note ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t flex items-center justify-between text-sm">
        <div className="text-gray-500">
          Total: <span className="font-medium text-gray-900">{total}</span> • Page{" "}
          <span className="font-medium text-gray-900">{page}</span> /{" "}
          <span className="font-medium text-gray-900">{totalPages}</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            aria-disabled={!canPrev}
            href={canPrev ? buildHref(pathname, sp, { page: String(page - 1) }) : "#"}
            className={`px-3 py-2 rounded-xl border ${
              canPrev ? "bg-white hover:bg-gray-50" : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            ← Prev
          </Link>

          <Link
            aria-disabled={!canNext}
            href={canNext ? buildHref(pathname, sp, { page: String(page + 1) }) : "#"}
            className={`px-3 py-2 rounded-xl border ${
              canNext ? "bg-white hover:bg-gray-50" : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            Next →
          </Link>
        </div>
      </div>
    </div>
  );
}
