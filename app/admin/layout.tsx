import type { ReactNode } from "react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">ADMIN</span>
            <span className="text-lg font-semibold text-black">Monitoring</span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/admin"
              className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/lockers"
              className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Lockers
            </Link>
            <Link
              href="/admin/users"
              className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Users
            </Link>
<form action="/admin/logout" method="POST">
  <button className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm">
    Logout
  </button>
</form>
          </nav>
        </div>
      </div>

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
