import { NextResponse } from "next/server";

import { createAuditLog, resolveAuditActor } from "@/lib/audit";
import { isAuthenticated } from "@/lib/auth";
import connectToDatabase from "@/lib/db/mongodb";
import { formatEcuadorMonthKey } from "@/lib/datetime/ecuador";
import { parseMonthKey } from "@/lib/planning/holidays";
import Employee from "@/models/Employee";
import MonthlyAttendanceClosure from "@/models/MonthlyAttendanceClosure";

function currentMonthKey() {
  return formatEcuadorMonthKey();
}

function minutesLabel(minutes) {
  const value = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(value / 60);
  const rest = value % 60;

  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function serializeClosure(closure) {
  if (!closure) return null;

  const rowDocs = closure.rows || [];
  const totals = closure.totals || {};

  return {
    id: closure._id.toString(),
    monthKey: closure.monthKey,
    version: Number(closure.version) || 1,
    isLatest: closure.isLatest !== false,
    status: closure.status || "closed",
    closedBy: closure.closedBy || "admin",
    closedAt: closure.closedAt,
    totals: {
      ...totals,
      regularWorkedLabel: minutesLabel(totals.regularWorkedMinutes),
      supplementaryLabel: minutesLabel(totals.supplementaryMinutes),
      extraordinaryLabel: minutesLabel(totals.extraordinaryMinutes),
      lateLabel: minutesLabel(totals.lateMinutes),
    },
    rows: rowDocs.map((row) => ({
      employeeId: row.employee?.toString?.() || "",
      employeeName: row.employeeName || "",
      branchCode: row.branchCode || "",
      branchName: row.branchName || "",
      areaCode: row.areaCode || "",
      areaName: row.areaName || "",
      roleCode: row.roleCode || "",
      roleName: row.roleName || "",
      plannedDays: Number(row.plannedDays) || 0,
      daysWithPunches: Number(row.daysWithPunches) || 0,
      missingPunchDays: Number(row.missingPunchDays) || 0,
      unplannedWorkDays: Number(row.unplannedWorkDays) || 0,
      lateDays: Number(row.lateDays) || 0,
      regularWorkedMinutes: Number(row.regularWorkedMinutes) || 0,
      supplementaryMinutes: Number(row.supplementaryMinutes) || 0,
      extraordinaryMinutes: Number(row.extraordinaryMinutes) || 0,
      lateMinutes: Number(row.lateMinutes) || 0,
      regularWorkedLabel: minutesLabel(row.regularWorkedMinutes),
      supplementaryLabel: minutesLabel(row.supplementaryMinutes),
      extraordinaryLabel: minutesLabel(row.extraordinaryMinutes),
      lateLabel: minutesLabel(row.lateMinutes),
    })),
  };
}

function serializePreview(snapshot) {
  return {
    rows: snapshot.rows.map((row) => ({
      ...row,
      regularWorkedLabel: minutesLabel(row.regularWorkedMinutes),
      supplementaryLabel: minutesLabel(row.supplementaryMinutes),
      extraordinaryLabel: minutesLabel(row.extraordinaryMinutes),
      lateLabel: minutesLabel(row.lateMinutes),
    })),
    totals: {
      ...snapshot.totals,
      regularWorkedLabel: minutesLabel(snapshot.totals.regularWorkedMinutes),
      supplementaryLabel: minutesLabel(snapshot.totals.supplementaryMinutes),
      extraordinaryLabel: minutesLabel(snapshot.totals.extraordinaryMinutes),
      lateLabel: minutesLabel(snapshot.totals.lateMinutes),
    },
  };
}

function approvedSupplementaryMinutes(days = []) {
  return days.reduce((total, day) => {
    if (day.authorization?.isSaved) {
      return total + (Number(day.supplementaryMinutes) || 0);
    }

    const plannedSupplementaryMinutes = Number(day.plannedSupplementaryMinutes) || 0;

    if (plannedSupplementaryMinutes > 0) {
      return total + Math.min(Number(day.supplementaryMinutes) || 0, plannedSupplementaryMinutes);
    }

    return total;
  }, 0);
}

function approvedExtraordinaryMinutes(days = []) {
  return days.reduce((total, day) => {
    if (!day.authorization?.isSaved) {
      return total;
    }

    return total + (Number(day.extraordinaryMinutes) || 0);
  }, 0);
}

function snapshotRows(comparisonRows) {
  return comparisonRows.map((row) => {
    const days = row.days || [];

    return {
      employeeId: row.employee.id,
      employee: row.employee.id,
      employeeName: row.employee.fullName,
      branchCode: row.employee.branchCode,
      branchName: row.employee.branchName,
      areaCode: row.employee.areaCode,
      areaName: row.employee.areaName,
      roleCode: row.employee.roleCode,
      roleName: row.employee.roleName,
      plannedDays: row.summary.plannedDays,
      daysWithPunches: row.summary.daysWithPunches,
      missingPunchDays: row.summary.missingPunchDays,
      unplannedWorkDays: row.summary.unplannedWorkDays,
      lateDays: row.summary.lateDays,
      regularWorkedMinutes: row.summary.regularWorkedMinutes,
      supplementaryMinutes: approvedSupplementaryMinutes(days),
      extraordinaryMinutes: approvedExtraordinaryMinutes(days),
      lateMinutes: row.summary.lateMinutes,
    };
  });
}

function sumTotals(rows) {
  return rows.reduce(
    (totals, row) => {
      totals.employees += 1;
      totals.plannedDays += row.plannedDays;
      totals.daysWithPunches += row.daysWithPunches;
      totals.missingPunchDays += row.missingPunchDays;
      totals.unplannedWorkDays += row.unplannedWorkDays;
      totals.lateDays += row.lateDays;
      totals.regularWorkedMinutes += row.regularWorkedMinutes;
      totals.supplementaryMinutes += row.supplementaryMinutes;
      totals.extraordinaryMinutes += row.extraordinaryMinutes;
      totals.lateMinutes += row.lateMinutes;
      return totals;
    },
    {
      employees: 0,
      plannedDays: 0,
      daysWithPunches: 0,
      missingPunchDays: 0,
      unplannedWorkDays: 0,
      lateDays: 0,
      regularWorkedMinutes: 0,
      supplementaryMinutes: 0,
      extraordinaryMinutes: 0,
      lateMinutes: 0,
    },
  );
}

function formatPayrollMinutes(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(value / 60);
  const rest = value % 60;

  return `${hours},${String(rest).padStart(2, "0")}`;
}

function escapeCsvCell(value) {
  const text = String(value ?? "");

  if (!/[;"\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function monthRangeFromKey(monthKey) {
  const { year, monthIndex } = parseMonthKey(monthKey);

  return {
    monthStart: new Date(year, monthIndex, 1),
    nextMonthStart: new Date(year, monthIndex + 1, 1),
  };
}

function wasEmployeeInPayrollDuringMonth(employee, monthStart) {
  if (!employee) return false;
  if ((employee.employmentRelation || "nomina") !== "nomina") return false;
  if (employee.isActive !== false) return true;
  if (!employee.terminationDate) return false;

  return new Date(employee.terminationDate) >= monthStart;
}

function getRowEmployeeId(row) {
  return row.employee?.toString?.() || row.employeeId || "";
}

async function buildPayrollCsv(rows, monthKey) {
  const { monthStart } = monthRangeFromKey(monthKey);
  const employeeIds = [...new Set(rows.map(getRowEmployeeId).filter(Boolean))];
  const employees = employeeIds.length
    ? await Employee.find({ _id: { $in: employeeIds } }).select({
        dni: 1,
        employmentRelation: 1,
        isActive: 1,
        terminationDate: 1,
      }).lean()
    : [];
  const employeesById = new Map(employees.map((employee) => [employee._id.toString(), employee]));
  const lines = [
    ["Cedula", "HorasSuplementarias", "HorasExtraordinarias", "HorasNocturnas", "", "", ""],
    ...rows
      .slice()
      .sort((left, right) => String(left.employeeName || "").localeCompare(String(right.employeeName || ""), "es"))
      .filter((row) => wasEmployeeInPayrollDuringMonth(employeesById.get(getRowEmployeeId(row)), monthStart))
      .map((row) => {
        const employeeId = getRowEmployeeId(row);
        const employee = employeesById.get(employeeId);

        return [
          employee?.dni || "",
          formatPayrollMinutes(row.supplementaryMinutes),
          formatPayrollMinutes(row.extraordinaryMinutes),
          formatPayrollMinutes(0),
          "",
          "",
          row.employeeName || "",
        ];
      }),
  ];

  return `\uFEFF${lines.map((line) => line.map(escapeCsvCell).join(";")).join("\r\n")}\r\n`;
}

async function ensureMonthlyClosureIndexes() {
  const collection = MonthlyAttendanceClosure.collection;
  const indexes = await collection.indexes();
  const legacyMonthIndex = indexes.find((index) =>
    index.name === "monthKey_1" &&
    index.unique &&
    Object.keys(index.key || {}).length === 1 &&
    index.key.monthKey === 1
  );

  if (legacyMonthIndex) {
    await collection.dropIndex(legacyMonthIndex.name);
  }

  await collection.createIndex({ monthKey: 1, version: 1 }, { unique: true, name: "monthKey_1_version_1" });
  await collection.createIndex({ monthKey: 1, isLatest: 1 }, { name: "monthKey_1_isLatest_1" });
}

async function buildComparisonSnapshot(request, monthKey) {
  const url = new URL("/api/attendance/comparison", request.url);
  url.searchParams.set("month", monthKey);

  const response = await fetch(url, {
    headers: {
      cookie: request.headers.get("cookie") || "",
    },
    cache: "no-store",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "No se pudo calcular el cierre del mes.");
  }

  const rows = snapshotRows(payload.rows || []);

  return {
    rows,
    totals: sumTotals(rows),
  };
}

export async function GET(request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesion invalida o expirada." }, { status: 401 });
  }

  try {
    await connectToDatabase();
    await ensureMonthlyClosureIndexes();

    const monthKey = parseMonthKey(request.nextUrl.searchParams.get("month") || currentMonthKey()).monthKey;
    const mode = String(request.nextUrl.searchParams.get("mode") || "").trim();
    const wantsLive = mode === "live";
    const wantsPayrollCsv = request.nextUrl.searchParams.get("export") === "payroll-csv";
    const closure = await MonthlyAttendanceClosure.findOne({ monthKey, isLatest: { $ne: false } })
      .sort({ version: -1, closedAt: -1 })
      .lean();
    const snapshot = wantsLive || !closure ? await buildComparisonSnapshot(request, monthKey) : null;

    if (wantsPayrollCsv) {
      const rows = snapshot?.rows || closure?.rows || [];
      const csv = await buildPayrollCsv(rows, monthKey);

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="cierre-mensual-${monthKey}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      monthKey,
      isClosed: Boolean(closure),
      mode: wantsLive ? "live" : "saved",
      closure: serializeClosure(closure),
      preview: snapshot ? serializePreview(snapshot) : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo cargar el cierre del mes." },
      { status: 400 },
    );
  }
}

export async function POST(request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesion invalida o expirada." }, { status: 401 });
  }

  try {
    await connectToDatabase();
    await ensureMonthlyClosureIndexes();

    const body = await request.json().catch(() => ({}));
    const monthKey = parseMonthKey(body.month || currentMonthKey()).monthKey;
    const latest = await MonthlyAttendanceClosure.findOne({ monthKey })
      .sort({ version: -1, closedAt: -1 })
      .lean();
    const version = Number(latest?.version || 0) + 1;

    const snapshot = await buildComparisonSnapshot(request, monthKey);
    const actor = await resolveAuditActor();
    await MonthlyAttendanceClosure.updateMany({ monthKey, isLatest: { $ne: false } }, { $set: { isLatest: false } });
    const closure = await MonthlyAttendanceClosure.create({
      monthKey,
      version,
      isLatest: true,
      rows: snapshot.rows,
      totals: snapshot.totals,
      closedBy: actor,
      closedAt: new Date(),
    });

    await createAuditLog({
      actor,
      action: "attendanceMonthlyClosure.create",
      entityType: "monthlyAttendanceClosure",
      entityId: closure._id.toString(),
      entityLabel: monthKey,
      route: "/api/attendance/monthly-closure",
      details: {
        monthKey,
        version,
        previousVersion: Number(latest?.version) || null,
        employees: snapshot.totals.employees,
        regularWorkedMinutes: snapshot.totals.regularWorkedMinutes,
        supplementaryMinutes: snapshot.totals.supplementaryMinutes,
        extraordinaryMinutes: snapshot.totals.extraordinaryMinutes,
        lateMinutes: snapshot.totals.lateMinutes,
      },
    });

    return NextResponse.json({
      message: "Cierre mensual guardado.",
      isClosed: true,
      closure: serializeClosure(closure.toObject()),
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo guardar el cierre mensual." },
      { status: 400 },
    );
  }
}
