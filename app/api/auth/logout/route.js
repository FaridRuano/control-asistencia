import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });

  return NextResponse.json({ success: true });
}
