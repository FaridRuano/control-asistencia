import crypto from "node:crypto";

import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "control_asistencia_session";

function getRequiredEnvValue(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}.`);
  }

  return value;
}

export function getAuthConfig() {
  return {
    username: getRequiredEnvValue("AUTH_USERNAME"),
    password: getRequiredEnvValue("AUTH_PASSWORD"),
  };
}

export function createSessionToken() {
  const { username, password } = getAuthConfig();
  return crypto.createHash("sha256").update(`${username}:${password}`).digest("hex");
}

export function validateCredentials(username, password) {
  const authConfig = getAuthConfig();
  return username === authConfig.username && password === authConfig.password;
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return false;
  }

  return sessionCookie.value === createSessionToken();
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  };
}
