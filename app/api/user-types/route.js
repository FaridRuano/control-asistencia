import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import connectToDatabase from "@/lib/db/mongodb";
import {
  DEFAULT_USER_TYPES,
  normalizeUserTypePayload,
  serializeUserType,
} from "@/lib/user-types";
import UserType from "@/models/UserType";

async function ensureDefaultUserTypes() {
  await Promise.all(
    DEFAULT_USER_TYPES.map((userType) =>
      UserType.updateOne(
        { code: userType.code },
        { $setOnInsert: userType },
        { upsert: true },
      ),
    ),
  );
}

export async function GET() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  await connectToDatabase();
  await ensureDefaultUserTypes();

  const userTypes = await UserType.find({}).sort({ name: 1 }).lean();

  return NextResponse.json({
    userTypes: userTypes.map(serializeUserType),
  });
}

export async function POST(request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const body = await request.json();
    const payload = normalizeUserTypePayload(body);
    const userType = await UserType.create(payload);

    return NextResponse.json(
      {
        userType: serializeUserType(userType),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const message = field === "name"
        ? "Ya existe un tipo de usuario con ese nombre."
        : "Ya existe un tipo de usuario con ese código.";

      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json(
      { error: error.message || "No se pudo crear el tipo de usuario." },
      { status: 400 },
    );
  }
}
