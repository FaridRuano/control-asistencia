import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import connectToDatabase from "@/lib/db/mongodb";
import AttendanceDayDecision from "@/models/AttendanceDayDecision";
import Employee from "@/models/Employee";

const DECISIONS = new Set(["full", "planned", "none", "custom", "discount_day", "pay_planned_day", "reviewed"]);

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
  const detectedLateMinutes = minutes(body?.detectedLateMinutes);
  let authorizedSupplementaryMinutes = minutes(body?.authorizedSupplementaryMinutes);
  let authorizedExtraordinaryMinutes = minutes(body?.authorizedExtraordinaryMinutes);
  let adjustedLateMinutes = body?.adjustedLateMinutes === undefined || body?.adjustedLateMinutes === null
    ? detectedLateMinutes
    : minutes(body?.adjustedLateMinutes);

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
    adjustedLateMinutes = 0;
  }

  if (decision === "reviewed") {
    authorizedSupplementaryMinutes = 0;
    authorizedExtraordinaryMinutes = 0;
    adjustedLateMinutes = detectedLateMinutes;
  }

  authorizedSupplementaryMinutes = Math.min(authorizedSupplementaryMinutes, detectedSupplementaryMinutes);
  authorizedExtraordinaryMinutes = Math.min(authorizedExtraordinaryMinutes, detectedExtraordinaryMinutes);
  adjustedLateMinutes = Math.min(adjustedLateMinutes, detectedLateMinutes);

  return {
    employeeId,
    dateKey,
    decision,
    authorizedSupplementaryMinutes,
    authorizedExtraordinaryMinutes,
    detectedSupplementaryMinutes,
    detectedExtraordinaryMinutes,
    detectedLateMinutes,
    adjustedLateMinutes,
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
          detectedLateMinutes: payload.detectedLateMinutes,
          adjustedLateMinutes: payload.adjustedLateMinutes,
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
          detectedLateMinutes: previousDecision.detectedLateMinutes || 0,
          adjustedLateMinutes: previousDecision.adjustedLateMinutes || 0,
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
          detectedLateMinutes: payload.detectedLateMinutes,
          adjustedLateMinutes: payload.adjustedLateMinutes,
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

export async function DELETE(request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const employeeId = String(body?.employeeId || "").trim();
    const dateKey = parseDateKey(body?.dateKey);

    if (!employeeId) {
      throw new Error("Debes indicar el empleado.");
    }

    await connectToDatabase();

    const employee = await Employee.findById(employeeId).select("_id fullName").lean();

    if (!employee) {
      return NextResponse.json({ error: "Empleado no encontrado." }, { status: 404 });
    }

    const previousDecision = await AttendanceDayDecision.findOne({ employee: employeeId, dateKey }).lean();
    const actor = user.employeeName || user.username || user.id;

    await AttendanceDayDecision.deleteOne({ employee: employeeId, dateKey });

    await createAuditLog({
      actor,
      action: "attendanceDayDecision.delete",
      entityType: "attendanceDayDecision",
      entityId: previousDecision?._id?.toString?.() || "",
      entityLabel: `${employee.fullName || employeeId} ${dateKey}`,
      route: "/api/attendance/day-decisions",
      details: {
        employeeId,
        employeeName: employee.fullName || "",
        dateKey,
        before: previousDecision ? {
          decision: previousDecision.decision,
          authorizedSupplementaryMinutes: previousDecision.authorizedSupplementaryMinutes,
          authorizedExtraordinaryMinutes: previousDecision.authorizedExtraordinaryMinutes,
          detectedSupplementaryMinutes: previousDecision.detectedSupplementaryMinutes,
          detectedExtraordinaryMinutes: previousDecision.detectedExtraordinaryMinutes,
          detectedLateMinutes: previousDecision.detectedLateMinutes || 0,
          adjustedLateMinutes: previousDecision.adjustedLateMinutes || 0,
          note: previousDecision.note || "",
          decidedBy: previousDecision.decidedBy || "",
          updatedAt: previousDecision.updatedAt || null,
        } : null,
        after: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Revisión quitada correctamente.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo quitar la decisión del día." },
      { status: 400 },
    );
  }
}
