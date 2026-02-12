import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.redirect(new URL("/admin-login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));

  // hapus cookie
  res.cookies.set("admin_session", "", {
    path: "/",
    maxAge: 0,
  });

  return res;
}
