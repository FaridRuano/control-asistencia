import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import parseAttendanceFile from "@/lib/attendance/parseAttendanceFile";
import connectToDatabase from "@/lib/db/mongodb";
import AttendanceUpload from "@/models/AttendanceUpload";

function normalizeStoredFileToBuffer(value) {
  if (!value) {
    return Buffer.alloc(0);
  }

  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value.buffer) {
    return Buffer.from(value.buffer);
  }

  return Buffer.from(value);
}

function buildNormalizedPayload(upload, normalizedSnapshot, source) {
  return {
    upload: {
      id: upload._id.toString(),
      fileName: upload.fileName,
      createdAt: upload.createdAt,
      status: upload.status,
      normalizedAt: upload.normalizedAt,
    },
    summary: {
      totalEmployees: normalizedSnapshot.summary.totalEmployees,
      totalPunches: normalizedSnapshot.summary.totalPunches,
      month: normalizedSnapshot.summary.month,
      year: normalizedSnapshot.summary.year,
    },
    employees: normalizedSnapshot.employees,
    parserLogs: normalizedSnapshot.parserLogs,
    source,
  };
}

function buildNormalizedSnapshot(parsedFile) {
  return {
    summary: {
      totalEmployees: parsedFile.employees.length,
      totalPunches: parsedFile.totalPunches,
      month: parsedFile.month,
      year: parsedFile.year,
    },
    employees: parsedFile.employees.map((employee) => ({
      biometricCode: employee.biometricCode,
      fullName: employee.name,
      department: employee.department,
      punchCount: employee.punches.length,
      punches: employee.punches.map((punch) => ({
        punchedAt: punch.punchedAt,
        rawValue: punch.rawValue,
      })),
    })),
    parserLogs: parsedFile.logs,
  };
}

export async function GET(_request, context) {
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

    const upload = await AttendanceUpload.findById(uploadId).lean();

    if (!upload) {
      return NextResponse.json({ error: "Archivo cargado no encontrado." }, { status: 404 });
    }

    if (upload.normalizedSnapshot?.employees?.length) {
      return NextResponse.json(
        buildNormalizedPayload(upload, upload.normalizedSnapshot, "saved"),
      );
    }

    const originalFileBuffer = normalizeStoredFileToBuffer(upload.originalFile);

    if (!originalFileBuffer.length) {
      return NextResponse.json(
        { error: "El archivo guardado no tiene contenido legible." },
        { status: 400 },
      );
    }

    const parsedFile = parseAttendanceFile({
      buffer: originalFileBuffer,
      fileName: upload.fileName,
    });

    return NextResponse.json(
      buildNormalizedPayload(upload, buildNormalizedSnapshot(parsedFile), "live"),
    );
  } catch (error) {
    console.error("attendance-normalize-error", error);

    return NextResponse.json(
      { error: error.message || "No se pudo normalizar el archivo seleccionado." },
      { status: 500 },
    );
  }
}

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

    const originalFileBuffer = normalizeStoredFileToBuffer(upload.originalFile);

    if (!originalFileBuffer.length) {
      return NextResponse.json(
        { error: "El archivo guardado no tiene contenido legible." },
        { status: 400 },
      );
    }

    const parsedFile = parseAttendanceFile({
      buffer: originalFileBuffer,
      fileName: upload.fileName,
    });

    upload.normalizedSnapshot = buildNormalizedSnapshot(parsedFile);
    upload.normalizedAt = new Date();
    await upload.save();

    return NextResponse.json({
      message: "Normalización guardada correctamente.",
      ...buildNormalizedPayload(upload, upload.normalizedSnapshot, "saved"),
    });
  } catch (error) {
    console.error("attendance-normalize-save-error", error);

    return NextResponse.json(
      { error: error.message || "No se pudo guardar la normalización." },
      { status: 500 },
    );
  }
}
