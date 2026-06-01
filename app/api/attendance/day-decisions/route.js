import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import connectToDatabase from "@/lib/db/mongodb";
import AttendanceDayDecision from "@/models/AttendanceDayDecision";
import Employee from "@/models/Employee";

const DECISIONS = new Set(["full", "planned", "none", "custom", "discount_day"]);

function minutes(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function parseDateKey(value) {
  const dateKey = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("La fecha de la decisión no es válida.");
  }

  return dateKey;
}

function normalizePayload(body) {
  const employeeId = String(body?.employeeId || "").trim();
  const dateKey = parseDateKey(body?.dateKey);
  const decision = String(body?.decision || "custom").trim();
  const detectedSupplementaryMinutes = minutes(body?.detectedSupplementaryMinutes);
  const detectedExtraordinaryMinutes = minutes(body?.detectedExtraordinaryMinutes);
  let authorizedSupplementaryMinutes = minutes(body?.authorizedSupplementaryMinutes);
  let authorizedExtraordinaryMinutes = minutes(body?.authorizedExtraordinaryMinutes);

  if (!employeeId) {
    throw new Error("Debes indicar el empleado.");
  }

  if (!DECISIONS.has(decision)) {
    throw new Error("La decisión no es válida.");
  }

  if (decision === "full") {
    authorizedSupplementaryMinutes = detectedSupplementaryMinutes;
    authorizedExtraordinaryMinutes = detectedExtraordinaryMinutes;
  }

  if (decision === "none" || decision === "discount_day") {
    authorizedSupplementaryMinutes = 0;
    authorizedExtraordinaryMinutes = 0;
  }

  authorizedSupplementaryMinutes = Math.min(authorizedSupplementaryMinutes, detectedSupplementaryMinutes);
  authorizedExtraordinaryMinutes = Math.min(authorizedExtraordinaryMinutes, detectedExtraordinaryMinutes);

  return {
    employeeId,
    dateKey,
    decision,
    authorizedSupplementaryMinutes,
    authorizedExtraordinaryMinutes,
    detectedSupplementaryMinutes,
    detectedExtraordinaryMinutes,
    note: String(body?.note || "").trim().slice(0, 240),
  };
}

export async function POST(request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  try {
    const payload = normalizePayload(await request.json());

    await connectToDatabase();

    const employee = await Employee.findById(payload.employeeId).select("_id fullName").lean();

    if (!employee) {
      return NextResponse.json({ error: "Empleado no encontrado." }, { status: 404 });
    }

    const date = new Date(`${payload.dateKey}T12:00:00.000Z`);
    const previousDecision = await AttendanceDayDecision.findOne({
      employee: payload.employeeId,
      dateKey: payload.dateKey,
    }).lean();
    const actor = user.employeeName || user.username || user.id;

    await AttendanceDayDecision.updateOne(
      {
        employee: payload.employeeId,
        dateKey: payload.dateKey,
      },
      {
        $set: {
          date,
          decision: payload.decision,
          authorizedSupplementaryMinutes: payload.authorizedSupplementaryMinutes,
          authorizedExtraordinaryMinutes: payload.authorizedExtraordinaryMinutes,
          detectedSupplementaryMinutes: payload.detectedSupplementaryMinutes,
          detectedExtraordinaryMinutes: payload.detectedExtraordinaryMinutes,
          note: payload.note,
          decidedBy: actor,
        },
        $setOnInsert: {
          employee: payload.employeeId,
          dateKey: payload.dateKey,
        },
      },
      { upsert: true },
    );
    const savedDecision = await AttendanceDayDecision.findOne({
      employee: payload.employeeId,
      dateKey: payload.dateKey,
    }).lean();

    await createAuditLog({
      actor,
      action: "attendanceDayDecision.upsert",
      entityType: "attendanceDayDecision",
      entityId: savedDecision?._id?.toString?.() || "",
      entityLabel: `${employee.fullName || payload.employeeId} ${payload.dateKey}`,
      route: "/api/attendance/day-decisions",
      details: {
        employeeId: payload.employeeId,
        employeeName: employee.fullName || "",
        dateKey: payload.dateKey,
        before: previousDecision ? {
          decision: previousDecision.decision,
          authorizedSupplementaryMinutes: previousDecision.authorizedSupplementaryMinutes,
          authorizedExtraordinaryMinutes: previousDecision.authorizedExtraordinaryMinutes,
          detectedSupplementaryMinutes: previousDecision.detectedSupplementaryMinutes,
          detectedExtraordinaryMinutes: previousDecision.detectedExtraordinaryMinutes,
          note: previousDecision.note || "",
          decidedBy: previousDecision.decidedBy || "",
          updatedAt: previousDecision.updatedAt || null,
        } : null,
        after: {
          decision: payload.decision,
          authorizedSupplementaryMinutes: payload.authorizedSupplementaryMinutes,
          authorizedExtraordinaryMinutes: payload.authorizedExtraordinaryMinutes,
          detectedSupplementaryMinutes: payload.detectedSupplementaryMinutes,
          detectedExtraordinaryMinutes: payload.detectedExtraordinaryMinutes,
          note: payload.note,
          decidedBy: actor,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Decisión guardada correctamente.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo guardar la decisión del día." },
      { status: 400 },
    );
  }
}
