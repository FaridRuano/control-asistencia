import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import connectToDatabase from "@/lib/db/mongodb";
import {
  AUTHORIZATION_CONFIG_KEY,
  DEFAULT_AUTHORIZATION_CONFIG,
  normalizeAuthorizationConfigPayload,
  serializeAuthorizationConfig,
} from "@/lib/planning/authorizations";
import AuthorizationConfig from "@/models/AuthorizationConfig";

export async function GET() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesion invalida o expirada." }, { status: 401 });
  }

  await connectToDatabase();

  const config = await AuthorizationConfig.findOneAndUpdate(
    { key: AUTHORIZATION_CONFIG_KEY },
    { $setOnInsert: DEFAULT_AUTHORIZATION_CONFIG },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  return NextResponse.json({
    config: serializeAuthorizationConfig(config),
    source: "saved",
  });
}

export async function PUT(request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesion invalida o expirada." }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const body = await request.json();
    const payload = normalizeAuthorizationConfigPayload(body);
    const config = await AuthorizationConfig.findOneAndUpdate(
      { key: AUTHORIZATION_CONFIG_KEY },
      { $set: payload },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    return NextResponse.json({
      message: "Configuracion de autorizaciones guardada correctamente.",
      config: serializeAuthorizationConfig(config),
      source: "saved",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo guardar la configuracion de autorizaciones." },
      { status: 400 },
    );
  }
}
