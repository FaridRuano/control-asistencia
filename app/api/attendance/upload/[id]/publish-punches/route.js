import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import {
  buildPublishMessage,
  publishAttendancePunches,
} from "@/lib/attendance/publishAttendancePunches";
import connectToDatabase from "@/lib/db/mongodb";
import AttendanceUpload from "@/models/AttendanceUpload";

export async function POST(_request, context) {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
    }

    const params = await context.params;
    const uploadId = String(params?.id || "").trim();

    if (!uploadId) {
      return NextResponse.json({ error: "Debes indicar una carga válida." }, { status: 400 });
    }

    await connectToDatabase();

    const upload = await AttendanceUpload.findById(uploadId);

    if (!upload) {
      return NextResponse.json({ error: "Archivo cargado no encontrado." }, { status: 404 });
    }

    if (!upload.normalizedSnapshot?.employees?.length || !upload.normalizedAt) {
      return NextResponse.json(
        { error: "Primero debes guardar la normalización de esta carga." },
        { status: 400 },
      );
    }

    const result = await publishAttendancePunches(upload);

    return NextResponse.json({
      message: buildPublishMessage(result),
      ...result,
    });
  } catch (error) {
    console.error("attendance-publish-punches-error", error);

    return NextResponse.json(
      { error: error.message || "No se pudieron cargar las picadas a MongoDB." },
      { status: 500 },
    );
  }
}
