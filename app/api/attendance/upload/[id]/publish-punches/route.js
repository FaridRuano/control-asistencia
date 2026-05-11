import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import parseAttendanceFile from "@/lib/attendance/parseAttendanceFile";
import connectToDatabase from "@/lib/db/mongodb";
import AttendancePunch from "@/models/AttendancePunch";
import AttendanceUpload from "@/models/AttendanceUpload";
import Employee from "@/models/Employee";

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

function buildSnapshotFromParsedFile(parsedFile) {
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

async function findOrCreateEmployee(normalizedEmployee) {
  const fullName = String(normalizedEmployee.fullName || "").trim();
  const department = String(normalizedEmployee.department || "").trim();
  const biometricCode = String(normalizedEmployee.biometricCode || "").trim();

  let employee = null;

  if (fullName) {
    employee = await Employee.findOne({ fullName });
  }

  if (employee) {
    employee.biometricCode = biometricCode || employee.biometricCode || "";
    employee.department = department || employee.department || "";
    employee.isActive = true;
    await employee.save();
    return employee;
  }

  return Employee.create({
    biometricCode,
    fullName: fullName || biometricCode || "Empleado sin nombre",
    salary: 0,
    branch: "AMBATO",
    department,
    isActive: true,
  });
}

function buildPunchTimestampKey(value) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return String(parsed.getTime());
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

    if (!upload.normalizedSnapshot?.employees?.length || !upload.normalizedAt) {
      return NextResponse.json(
        { error: "Primero debes guardar la normalización de esta carga." },
        { status: 400 },
      );
    }

    const normalizedSnapshot = upload.normalizedSnapshot;

    await AttendancePunch.deleteMany({ upload: upload._id });

    let publishedEmployees = 0;
    let publishedPunches = 0;
    let skippedDuplicatePunches = 0;

    for (const normalizedEmployee of normalizedSnapshot.employees || []) {
      const employee = await findOrCreateEmployee(normalizedEmployee);

      const rawPunches = (normalizedEmployee.punches || []).map((punch) => ({
        upload: upload._id,
        employee: employee._id,
        punchedAt: punch.punchedAt,
        rawValue: punch.rawValue || "",
      }));

      const uniquePunchesByTimestamp = new Map();

      rawPunches.forEach((punch) => {
        const timestampKey = buildPunchTimestampKey(punch.punchedAt);

        if (!timestampKey || uniquePunchesByTimestamp.has(timestampKey)) {
          return;
        }

        uniquePunchesByTimestamp.set(timestampKey, punch);
      });

      const uniquePunches = [...uniquePunchesByTimestamp.values()];

      if (uniquePunches.length) {
        const existingPunches = await AttendancePunch.find({
          employee: employee._id,
          punchedAt: {
            $in: uniquePunches.map((punch) => punch.punchedAt),
          },
        })
          .select({ punchedAt: 1 })
          .lean();

        const existingTimestampKeys = new Set(
          existingPunches.map((punch) => buildPunchTimestampKey(punch.punchedAt)),
        );

        const punchesToInsert = uniquePunches.filter(
          (punch) => !existingTimestampKeys.has(buildPunchTimestampKey(punch.punchedAt)),
        );

        skippedDuplicatePunches += uniquePunches.length - punchesToInsert.length;

        if (punchesToInsert.length) {
          await AttendancePunch.insertMany(punchesToInsert, { ordered: false });
        }

        publishedPunches += punchesToInsert.length;
      } else {
        skippedDuplicatePunches += rawPunches.length;
      }

      publishedEmployees += 1;
    }

    upload.punchesPublishedAt = new Date();
    upload.publishedEmployees = publishedEmployees;
    upload.publishedPunches = publishedPunches;
    await upload.save();

    return NextResponse.json({
      message:
        skippedDuplicatePunches > 0
          ? "Las picadas se cargaron y se omitieron duplicados ya existentes."
          : "Las picadas se cargaron correctamente en el sistema.",
      publishedAt: upload.punchesPublishedAt,
      publishedEmployees,
      publishedPunches,
      skippedDuplicatePunches,
    });
  } catch (error) {
    console.error("attendance-publish-punches-error", error);

    return NextResponse.json(
      { error: error.message || "No se pudieron cargar las picadas a MongoDB." },
      { status: 500 },
    );
  }
}
