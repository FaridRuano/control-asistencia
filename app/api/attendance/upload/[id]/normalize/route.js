import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import parseAttendanceFile from "@/lib/attendance/parseAttendanceFile";
import {
  buildPublishMessage,
  publishAttendancePunches,
} from "@/lib/attendance/publishAttendancePunches";
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
  const publishSummary = upload.punchesPublishedAt
    ? {
        publishedAt: upload.punchesPublishedAt,
        publishedEmployees: upload.publishedEmployees || 0,
        publishedPunches: upload.publishedPunches || 0,
        skippedDuplicatePunches: upload.skippedDuplicatePunches || 0,
        skippedUnmatchedEmployees: upload.skippedUnmatchedEmployees || 0,
        skippedUnmatchedPunches: upload.skippedUnmatchedPunches || 0,
      }
    : null;

  return {
    upload: {
      id: upload._id.toString(),
      fileName: upload.fileName,
      branchCode: upload.branchCode || "",
      branchName: upload.branchName || "",
      createdAt: upload.createdAt,
      status: upload.status,
      normalizedAt: upload.normalizedAt,
      punchesPublishedAt: upload.punchesPublishedAt || null,
    },
    summary: {
      totalEmployees: normalizedSnapshot.summary.totalEmployees,
      totalPunches: normalizedSnapshot.summary.totalPunches,
      month: normalizedSnapshot.summary.month,
      year: normalizedSnapshot.summary.year,
    },
    employees: normalizedSnapshot.employees,
    parserLogs: normalizedSnapshot.parserLogs,
    publishSummary,
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
      branchCode: parsedFile.branchCode || "",
      branchName: parsedFile.branchName || "",
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
      branchCode: upload.branchCode || "",
      branchName: upload.branchName || "",
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
      branchCode: upload.branchCode || "",
      branchName: upload.branchName || "",
    });

    upload.normalizedSnapshot = buildNormalizedSnapshot(parsedFile);
    upload.normalizedAt = new Date();
    upload.punchesPublishedAt = null;
    upload.publishedEmployees = 0;
    upload.publishedPunches = 0;
    upload.skippedDuplicatePunches = 0;
    upload.skippedUnmatchedEmployees = 0;
    upload.skippedUnmatchedPunches = 0;
    await upload.save();

    const publishResult = await publishAttendancePunches(upload);

    return NextResponse.json({
      ...buildNormalizedPayload(upload, upload.normalizedSnapshot, "saved"),
      message: `Normalización guardada. ${buildPublishMessage(publishResult)}`,
      publishSummary: publishResult,
    });
  } catch (error) {
    console.error("attendance-normalize-save-error", error);

    return NextResponse.json(
      { error: error.message || "No se pudo guardar la normalización." },
      { status: 500 },
    );
  }
}
