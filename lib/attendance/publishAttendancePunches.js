import AttendancePunch from "@/models/AttendancePunch";
import Employee from "@/models/Employee";

async function findActiveEmployee(normalizedEmployee, upload) {
  const biometricCode = String(normalizedEmployee.biometricCode || "").trim();
  const branchCode = String(
    normalizedEmployee.branchCode || upload.branchCode || "",
  ).trim().toUpperCase();

  if (!biometricCode || !branchCode) {
    return null;
  }

  return Employee.findOne({
    branchCode,
    biometricCode,
    isActive: { $ne: false },
  });
}

function buildPunchTimestampKey(value) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return String(parsed.getTime());
}

export async function publishAttendancePunches(upload) {
  const normalizedSnapshot = upload.normalizedSnapshot;

  await AttendancePunch.deleteMany({ upload: upload._id });

  let publishedEmployees = 0;
  let publishedPunches = 0;
  let skippedDuplicatePunches = 0;
  let skippedUnmatchedEmployees = 0;
  let skippedUnmatchedPunches = 0;

  for (const normalizedEmployee of normalizedSnapshot.employees || []) {
    const employee = await findActiveEmployee(normalizedEmployee, upload);

    if (!employee) {
      skippedUnmatchedEmployees += 1;
      skippedUnmatchedPunches += normalizedEmployee.punches?.length || 0;
      continue;
    }

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
  upload.skippedDuplicatePunches = skippedDuplicatePunches;
  upload.skippedUnmatchedEmployees = skippedUnmatchedEmployees;
  upload.skippedUnmatchedPunches = skippedUnmatchedPunches;
  await upload.save();

  return {
    publishedAt: upload.punchesPublishedAt,
    publishedEmployees,
    publishedPunches,
    skippedDuplicatePunches,
    skippedUnmatchedEmployees,
    skippedUnmatchedPunches,
  };
}

export function buildPublishMessage(result) {
  if (result.skippedUnmatchedEmployees > 0) {
    return "Las picadas se cargaron y se omitieron códigos sin empleado activo en la sucursal.";
  }

  if (result.skippedDuplicatePunches > 0) {
    return "Las picadas se cargaron y se omitieron duplicados ya existentes.";
  }

  return "Las picadas se cargaron correctamente en el sistema.";
}
