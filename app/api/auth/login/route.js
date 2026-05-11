import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  validateCredentials,
} from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");

    if (!validateCredentials(username, password)) {
      return NextResponse.json(
        { error: "Usuario o clave incorrectos." },
        { status: 401 },
      );
    }

    const cookieStore = await cookies();
    cookieStore.set(
      SESSION_COOKIE_NAME,
      createSessionToken(),
      getSessionCookieOptions(),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo iniciar sesión." },
      { status: 500 },
    );
  }
}
