import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { token } = await req.json();

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json(
      { message: 'Admin token salah.' },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true });

  res.cookies.set('admin_token', token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 jam
  });

  return res;
}
