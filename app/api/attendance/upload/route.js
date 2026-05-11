import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import connectToDatabase from "@/lib/db/mongodb";
import AttendanceUpload from "@/models/AttendanceUpload";

const ACCEPTED_EXTENSIONS = [".xls", ".xlsx"];

function hasValidExcelExtension(fileName) {
  const normalizedName = String(fileName || "").toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => normalizedName.endsWith(extension));
}

export async function GET() {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
    }

    await connectToDatabase();

    const uploads = await AttendanceUpload.find(
      {},
      {
        originalFile: 0,
      },
    )
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return NextResponse.json({
      uploads: uploads.map((upload) => ({
        id: upload._id.toString(),
        fileName: upload.fileName,
        mimeType: upload.mimeType,
        fileSize: upload.fileSize,
        status: upload.status,
        month: upload.month,
        year: upload.year,
        normalizedAt: upload.normalizedAt || null,
        hasNormalization: Boolean(upload.normalizedAt),
        createdAt: upload.createdAt,
        updatedAt: upload.updatedAt,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo cargar el historial de archivos." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
    }

    await connectToDatabase();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json(
        { error: "Debes adjuntar un archivo Excel válido." },
        { status: 400 },
      );
    }

    if (!hasValidExcelExtension(file.name)) {
      return NextResponse.json(
        { error: "Solo se permiten archivos .xls o .xlsx." },
        { status: 400 },
      );
    }

    const originalFile = Buffer.from(await file.arrayBuffer());

    if (!originalFile.length) {
      return NextResponse.json(
        { error: "El archivo está vacío o no se pudo leer." },
        { status: 400 },
      );
    }

    const uploadDocument = await AttendanceUpload.create({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: originalFile.length,
      originalFile,
      status: "uploaded",
    });

    return NextResponse.json({
      message: "Archivo guardado correctamente.",
      upload: {
        id: uploadDocument._id.toString(),
        fileName: uploadDocument.fileName,
        mimeType: uploadDocument.mimeType,
        fileSize: uploadDocument.fileSize,
        status: uploadDocument.status,
        normalizedAt: null,
        hasNormalization: false,
        createdAt: uploadDocument.createdAt,
      },
    });
  } catch (error) {
    console.error("attendance-upload-store-error", error);

    return NextResponse.json(
      { error: error.message || "No se pudo guardar el archivo de asistencia." },
      { status: 500 },
    );
  }
}
