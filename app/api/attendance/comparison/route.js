import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import {
  formatEcuadorDate,
  formatEcuadorDateKey,
  formatEcuadorTime,
  makeEcuadorDate,
  setEcuadorTime,
} from "@/lib/datetime/ecuador";
import connectToDatabase from "@/lib/db/mongodb";
import { parseMonthKey } from "@/lib/planning/holidays";
import AttendancePunch from "@/models/AttendancePunch";
import Employee from "@/models/Employee";
import LaborRuleConfig from "@/models/LaborRuleConfig";
import ScheduleAssignment from "@/models/ScheduleAssignment";

const REGULAR_DAY_MINUTES = 8 * 60;
const MIN_REAL_LUNCH_MINUTES = 20;
const MAX_REAL_LUNCH_MINUTES = 180;

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function minutesLabel(minutes) {
  const value = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(value / 60);
  const rest = value % 60;

  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function toId(value) {
  return value?._id?.toString?.() || value?.toString?.() || "";
}

function combineDateAndTime(dateKey, timeValue) {
  if (!timeValue) return null;

  const [hours, minutes] = String(timeValue).split(":").map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return setEcuadorTime(new Date(`${dateKey}T12:00:00.000Z`), {
    hours,
    minutes,
    seconds: 0,
    milliseconds: 0,
  });
}

function isPlannedWorkDay(day) {
  return ["workday", "weekend_overtime"].includes(day?.dayType);
}

function dayTypeLabel(dayType) {
  const labels = {
    workday: "Laboral",
    weekend_overtime: "Extra",
    holiday: "Feriado",
    vacation: "Vacacion",
    off_day: "Descanso",
  };

  return labels[dayType] || dayType || "Sin horario";
}

function buildScheduleLabel(day) {
  if (!day) return "Sin horario";
  if (!isPlannedWorkDay(day)) return dayTypeLabel(day.dayType);
  return `${day.startTime || "--"} - ${day.endTime || "--"}`;
}

function resolveScheduledMinutes(day) {
  if (!isPlannedWorkDay(day)) {
    return {
      scheduledWorkedMinutes: 0,
      plannedRegularMinutes: 0,
      plannedSupplementaryMinutes: 0,
    };
  }

  const scheduleStart = combineDateAndTime(day.dateKey, day.startTime);
  const scheduleEnd = combineDateAndTime(day.dateKey, day.endTime);

  if (!scheduleStart || !scheduleEnd || scheduleEnd <= scheduleStart) {
    return {
      scheduledWorkedMinutes: 0,
      plannedRegularMinutes: 0,
      plannedSupplementaryMinutes: 0,
    };
  }

  const lunchDiscount = Number(day.lunchDurationMinutes) || 0;
  const scheduledWorkedMinutes = Math.max(0, Math.round((scheduleEnd - scheduleStart) / 60000) - lunchDiscount);
  const plannedRegularMinutes = day.dayType === "workday"
    ? Math.min(scheduledWorkedMinutes, REGULAR_DAY_MINUTES)
    : 0;
  const plannedSupplementaryMinutes = day.dayType === "workday"
    ? Math.max(0, scheduledWorkedMinutes - plannedRegularMinutes)
    : 0;

  return {
    scheduledWorkedMinutes,
    plannedRegularMinutes,
    plannedSupplementaryMinutes,
  };
}

function resolveActualLunchMinutes(sortedPunches) {
  if (sortedPunches.length < 4) return null;

  const lunchOut = sortedPunches[1];
  const lunchIn = sortedPunches[2];

  if (!lunchOut || !lunchIn || lunchIn.punchedAt <= lunchOut.punchedAt) return null;

  const lunchMinutes = Math.max(0, Math.round((lunchIn.punchedAt - lunchOut.punchedAt) / 60000));

  if (lunchMinutes < MIN_REAL_LUNCH_MINUTES || lunchMinutes > MAX_REAL_LUNCH_MINUTES) return null;

  return lunchMinutes;
}

function compareDay(day, punches, laborRules) {
  const sortedPunches = [...punches].sort((left, right) => left.punchedAt - right.punchedAt);
  const punchCount = sortedPunches.length;
  const isWorkingDay = isPlannedWorkDay(day);
  const hasLunch = isWorkingDay && Number(day?.lunchDurationMinutes) > 0;
  const expectedPunches = isWorkingDay ? (hasLunch ? 4 : 2) : 0;
  const scheduleStart = isWorkingDay ? combineDateAndTime(day.dateKey, day.startTime) : null;
  const scheduleEnd = isWorkingDay ? combineDateAndTime(day.dateKey, day.endTime) : null;
  const graceMinutes = Number(day?.graceMinutes ?? laborRules?.defaultGraceMinutes ?? 10) || 0;
  const plannedMinutes = resolveScheduledMinutes(day);
  const firstPunch = sortedPunches[0] || null;
  const lastPunch = sortedPunches[punchCount - 1] || null;
  const tags = [];
  let workedMinutes = 0;
  let regularWorkedMinutes = 0;
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let supplementaryMinutes = 0;
  let extraordinaryMinutes = 0;
  let additionalSupplementaryMinutes = 0;
  let actualLunchMinutes = null;

  actualLunchMinutes = resolveActualLunchMinutes(sortedPunches);

  if (firstPunch && lastPunch && lastPunch.punchedAt > firstPunch.punchedAt) {
    const grossMinutes = Math.max(0, Math.round((lastPunch.punchedAt - firstPunch.punchedAt) / 60000));
    const lunchDiscount = actualLunchMinutes ?? (hasLunch ? Number(day.lunchDurationMinutes) || 0 : 0);
    workedMinutes = Math.max(0, grossMinutes - lunchDiscount);
  }

  if (isWorkingDay && punchCount === 0) {
    tags.push("Sin picadas");
  }

  if (isWorkingDay && punchCount > 0 && punchCount < expectedPunches) {
    tags.push("Picadas incompletas");
  }

  if (isWorkingDay && punchCount > expectedPunches) {
    tags.push("Picadas adicionales");
  }

  if (isWorkingDay && punchCount % 2 !== 0) {
    tags.push("Cantidad irregular");
  }

  if (!isWorkingDay && punchCount > 0) {
    tags.push(day?.dayType === "holiday" ? "Trabajo en feriado" : "Trabajo sin horario");
  }

  if (isWorkingDay && scheduleStart && firstPunch && firstPunch.punchedAt > scheduleStart) {
    const rawLateMinutes = Math.max(0, Math.round((firstPunch.punchedAt - scheduleStart) / 60000));
    lateMinutes = rawLateMinutes > graceMinutes ? rawLateMinutes : 0;
    if (lateMinutes > 0) tags.push("Atraso");
  }

  if (isWorkingDay && scheduleEnd && lastPunch && lastPunch.punchedAt < scheduleEnd) {
    earlyLeaveMinutes = Math.max(0, Math.round((scheduleEnd - lastPunch.punchedAt) / 60000));
    if (earlyLeaveMinutes > 0) tags.push("Salida anticipada");
  }

  if (day?.dayType === "workday" && workedMinutes > REGULAR_DAY_MINUTES) {
    const extraOverRegular = workedMinutes - REGULAR_DAY_MINUTES;
    const plannedSupplementaryMinutes = plannedMinutes.plannedSupplementaryMinutes || Number(day.authorizedExtraMinutes) || 0;

    supplementaryMinutes = Math.min(extraOverRegular, plannedSupplementaryMinutes || extraOverRegular);
    additionalSupplementaryMinutes = Math.max(0, extraOverRegular - supplementaryMinutes);

    if (supplementaryMinutes > 0) tags.push("Suplementaria");
    if (additionalSupplementaryMinutes > 0) tags.push("Suplementaria adicional");
  }

  if (day?.dayType === "workday" && workedMinutes > 0) {
    regularWorkedMinutes = Math.min(workedMinutes, REGULAR_DAY_MINUTES);
  }

  if ((day?.dayType === "weekend_overtime" || !isWorkingDay) && workedMinutes > 0) {
    extraordinaryMinutes = workedMinutes;
    tags.push("Extraordinaria");
  }

  const hasIssue = tags.some((tag) =>
    !["Suplementaria", "Extraordinaria"].includes(tag),
  ) || additionalSupplementaryMinutes > 0;

  return {
    dateKey: day.dateKey,
    dateLabel: formatEcuadorDate(new Date(`${day.dateKey}T12:00:00.000Z`)),
    dayLabel: day.label || "",
    dayType: day.dayType || "off_day",
    dayTypeLabel: dayTypeLabel(day.dayType),
    scheduleLabel: buildScheduleLabel(day),
    startTime: day.startTime || "",
    endTime: day.endTime || "",
    lunchDurationMinutes: Number(day.lunchDurationMinutes) || 0,
    actualLunchMinutes,
    actualLunchLabel: actualLunchMinutes === null ? "--" : minutesLabel(actualLunchMinutes),
    authorizedExtraMinutes: Number(day.authorizedExtraMinutes) || 0,
    graceMinutes,
    scheduledWorkedMinutes: plannedMinutes.scheduledWorkedMinutes,
    plannedRegularMinutes: plannedMinutes.plannedRegularMinutes,
    plannedSupplementaryMinutes: plannedMinutes.plannedSupplementaryMinutes,
    scheduledWorkedLabel: plannedMinutes.scheduledWorkedMinutes ? minutesLabel(plannedMinutes.scheduledWorkedMinutes) : "--",
    plannedRegularLabel: plannedMinutes.plannedRegularMinutes ? minutesLabel(plannedMinutes.plannedRegularMinutes) : "--",
    plannedSupplementaryLabel: plannedMinutes.plannedSupplementaryMinutes ? minutesLabel(plannedMinutes.plannedSupplementaryMinutes) : "--",
    expectedPunches,
    punchCount,
    punches: sortedPunches.map((punch) => ({
      id: punch._id.toString(),
      time: formatEcuadorTime(punch.punchedAt),
      source: punch.source || "upload",
    })),
    workedMinutes,
    workedLabel: workedMinutes ? minutesLabel(workedMinutes) : "--",
    regularWorkedMinutes,
    regularWorkedLabel: regularWorkedMinutes ? minutesLabel(regularWorkedMinutes) : "--",
    lateMinutes,
    earlyLeaveMinutes,
    supplementaryMinutes,
    extraordinaryMinutes,
    extraordinaryLabel: extraordinaryMinutes ? minutesLabel(extraordinaryMinutes) : "--",
    additionalSupplementaryMinutes,
    additionalSupplementaryLabel: additionalSupplementaryMinutes ? minutesLabel(additionalSupplementaryMinutes) : "--",
    tags,
    hasIssue,
  };
}

function emptyEmployeeSummary() {
  return {
    plannedDays: 0,
    daysWithPunches: 0,
    missingPunchDays: 0,
    absentDays: 0,
    lateDays: 0,
    earlyLeaveDays: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    extraDays: 0,
    extraPunchDays: 0,
    unplannedWorkDays: 0,
    supplementaryMinutes: 0,
    regularWorkedMinutes: 0,
    extraordinaryMinutes: 0,
    unplannedExtraMinutes: 0,
    additionalSupplementaryMinutes: 0,
    issueDays: 0,
  };
}

export async function GET(request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesion invalida o expirada." }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const { searchParams } = request.nextUrl;
    const { monthKey, year, monthIndex } = parseMonthKey(searchParams.get("month") || currentMonthKey());
    const branchCode = String(searchParams.get("branchCode") || "").trim().toUpperCase();
    const areaCode = String(searchParams.get("areaCode") || "").trim();
    const roleCode = String(searchParams.get("roleCode") || "").trim();
    const employeeId = String(searchParams.get("employeeId") || "").trim();
    const start = makeEcuadorDate(year, monthIndex, 1);
    const end = makeEcuadorDate(year, monthIndex + 1, 1);
    const employeeQuery = { isActive: { $ne: false } };
    const assignmentQuery = { monthKey };

    if (branchCode) {
      employeeQuery.branchCode = branchCode;
      assignmentQuery.branchCode = branchCode;
    }

    if (areaCode) {
      employeeQuery.areaCode = areaCode;
      assignmentQuery.areaCode = areaCode;
    }

    if (roleCode) {
      employeeQuery.roleCode = roleCode;
      assignmentQuery.roleCode = roleCode;
    }

    if (employeeId) {
      employeeQuery._id = employeeId;
      assignmentQuery.employee = employeeId;
    }

    const [employees, assignments, laborRules] = await Promise.all([
      Employee.find(employeeQuery).sort({ branchName: 1, areaName: 1, roleName: 1, fullName: 1 }).lean(),
      ScheduleAssignment.find(assignmentQuery).lean(),
      LaborRuleConfig.findOne({ key: "default" }).lean(),
    ]);
    const employeeIds = employees.map((employee) => employee._id);
    const punches = employeeIds.length
      ? await AttendancePunch.find({
          employee: { $in: employeeIds },
          punchedAt: {
            $gte: start,
            $lt: end,
          },
        }).sort({ punchedAt: 1 }).lean()
      : [];
    const assignmentsByEmployee = new Map(
      assignments.map((assignment) => [toId(assignment.employee), assignment]),
    );
    const punchesByEmployeeDate = new Map();

    punches.forEach((punch) => {
      const key = `${toId(punch.employee)}|${formatEcuadorDateKey(punch.punchedAt)}`;

      if (!punchesByEmployeeDate.has(key)) {
        punchesByEmployeeDate.set(key, []);
      }

      punchesByEmployeeDate.get(key).push(punch);
    });

    const rows = employees.map((employee) => {
      const employeeKey = toId(employee);
      const assignment = assignmentsByEmployee.get(employeeKey);
      const days = (assignment?.generatedDays || []).map((day) =>
        compareDay(day, punchesByEmployeeDate.get(`${employeeKey}|${day.dateKey}`) || [], laborRules),
      );
      const summary = days.reduce((totals, day) => {
        if (isPlannedWorkDay(day)) totals.plannedDays += 1;
        if (day.punchCount > 0) totals.daysWithPunches += 1;
        if (day.tags.includes("Sin picadas")) totals.absentDays += 1;
        if (day.tags.includes("Picadas incompletas") || day.tags.includes("Cantidad irregular")) {
          totals.missingPunchDays += 1;
        }
        if (day.lateMinutes > 0) totals.lateDays += 1;
        if (day.earlyLeaveMinutes > 0) totals.earlyLeaveDays += 1;
        if (day.tags.includes("Picadas adicionales")) totals.extraPunchDays += 1;
        if (day.tags.includes("Trabajo sin horario") || day.tags.includes("Trabajo en feriado")) {
          totals.unplannedWorkDays += 1;
        }
        if (day.supplementaryMinutes > 0 || day.additionalSupplementaryMinutes > 0 || day.extraordinaryMinutes > 0) {
          totals.extraDays += 1;
        }
        if (day.hasIssue) totals.issueDays += 1;

        totals.lateMinutes += day.lateMinutes;
        totals.earlyLeaveMinutes += day.earlyLeaveMinutes;
        totals.regularWorkedMinutes += day.regularWorkedMinutes;
        totals.supplementaryMinutes += day.supplementaryMinutes;
        totals.extraordinaryMinutes += day.extraordinaryMinutes;
        totals.unplannedExtraMinutes += day.additionalSupplementaryMinutes;
        totals.additionalSupplementaryMinutes += day.additionalSupplementaryMinutes;
        return totals;
      }, emptyEmployeeSummary());

      return {
        employee: {
          id: employeeKey,
          fullName: employee.fullName || "",
          branchCode: employee.branchCode || "",
          branchName: employee.branchName || employee.branchCode || "",
          areaCode: employee.areaCode || "",
          areaName: employee.areaName || "",
          roleCode: employee.roleCode || "",
          roleName: employee.roleName || "",
        },
        hasSchedule: Boolean(assignment),
        templateName: assignment?.templateName || "",
        summary: {
          ...summary,
          regularWorkedLabel: minutesLabel(summary.regularWorkedMinutes),
          supplementaryLabel: minutesLabel(summary.supplementaryMinutes),
          extraordinaryLabel: minutesLabel(summary.extraordinaryMinutes),
          unplannedExtraLabel: minutesLabel(summary.unplannedExtraMinutes),
          additionalSupplementaryLabel: minutesLabel(summary.additionalSupplementaryMinutes),
          lateLabel: minutesLabel(summary.lateMinutes),
          earlyLeaveLabel: minutesLabel(summary.earlyLeaveMinutes),
        },
        days,
      };
    });

    const summary = rows.reduce(
      (totals, row) => {
        totals.employees += 1;
        if (!row.hasSchedule) totals.withoutSchedule += 1;
        if (row.summary.issueDays > 0 || !row.hasSchedule) totals.withIssues += 1;
        totals.issueDays += row.summary.issueDays;
        totals.absentDays += row.summary.absentDays;
        totals.missingPunchDays += row.summary.missingPunchDays;
        totals.lateDays += row.summary.lateDays;
        totals.earlyLeaveDays += row.summary.earlyLeaveDays;
        totals.lateMinutes += row.summary.lateMinutes;
        totals.earlyLeaveMinutes += row.summary.earlyLeaveMinutes;
        totals.extraDays += row.summary.extraDays;
        totals.unplannedWorkDays += row.summary.unplannedWorkDays;
        totals.regularWorkedMinutes += row.summary.regularWorkedMinutes;
        totals.supplementaryMinutes += row.summary.supplementaryMinutes;
        totals.extraordinaryMinutes += row.summary.extraordinaryMinutes;
        totals.unplannedExtraMinutes += row.summary.additionalSupplementaryMinutes;
        totals.additionalSupplementaryMinutes = (totals.additionalSupplementaryMinutes || 0) + row.summary.additionalSupplementaryMinutes;
        return totals;
      },
      {
        employees: 0,
        withIssues: 0,
        withoutSchedule: 0,
        issueDays: 0,
        absentDays: 0,
        missingPunchDays: 0,
        lateDays: 0,
        earlyLeaveDays: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        extraDays: 0,
        unplannedWorkDays: 0,
        regularWorkedMinutes: 0,
        supplementaryMinutes: 0,
        extraordinaryMinutes: 0,
        unplannedExtraMinutes: 0,
        additionalSupplementaryMinutes: 0,
      },
    );

    return NextResponse.json({
      monthKey,
      summary: {
        ...summary,
        regularWorkedLabel: minutesLabel(summary.regularWorkedMinutes),
        supplementaryLabel: minutesLabel(summary.supplementaryMinutes),
        extraordinaryLabel: minutesLabel(summary.extraordinaryMinutes),
        unplannedExtraLabel: minutesLabel(summary.unplannedExtraMinutes),
        additionalSupplementaryLabel: minutesLabel(summary.additionalSupplementaryMinutes),
        lateLabel: minutesLabel(summary.lateMinutes),
        earlyLeaveLabel: minutesLabel(summary.earlyLeaveMinutes),
      },
      rows,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo comparar la asistencia con el horario." },
      { status: 400 },
    );
  }
}
