import crypto from "node:crypto";

import { cookies } from "next/headers";

import connectToDatabase from "@/lib/db/mongodb";
import { verifyPassword } from "@/lib/users";
import User from "@/models/User";

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

function getSessionSecret() {
  return getRequiredEnvValue("SESSION_SECRET");
}

export function createUserSessionToken(userId) {
  const normalizedUserId = String(userId || "");
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(normalizedUserId)
    .digest("hex");

  return `user:${normalizedUserId}:${signature}`;
}

function resolveUserIdFromSessionToken(token) {
  const [, userId, signature] = String(token || "").split(":");

  if (!userId || !signature) {
    return "";
  }

  const expectedSignature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(userId)
    .digest("hex");

  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return "";
  }

  return userId;
}

export async function validateCredentials(username, password) {
  const authConfig = getAuthConfig();

  if (username === authConfig.username && password === authConfig.password) {
    return {
      type: "env",
      token: createSessionToken(),
    };
  }

  await connectToDatabase();

  const user = await User.findOne({
    username: String(username || "").trim().toLowerCase(),
  });

  if (!user || user.isActive === false || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

  return {
    type: "user",
    token: createUserSessionToken(user._id.toString()),
  };
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return false;
  }

  if (sessionCookie.value === createSessionToken()) {
    return true;
  }

  const userId = resolveUserIdFromSessionToken(sessionCookie.value);

  if (!userId) {
    return false;
  }

  await connectToDatabase();

  const user = await User.findById(userId).select("isActive").lean();

  return Boolean(user && user.isActive !== false);
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
