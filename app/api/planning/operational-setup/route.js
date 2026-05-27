import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import connectToDatabase from "@/lib/db/mongodb";
import { seedOperationalSetup } from "@/lib/planning/operationalSetup";

export async function POST() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesion invalida o expirada." }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const summary = await seedOperationalSetup();

    return NextResponse.json({
      message: "Catalogo operativo inicial cargado correctamente.",
      summary,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo cargar el catalogo operativo inicial." },
      { status: 400 },
    );
  }
}
