import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import { attendancePayrollPolicy } from "@/lib/attendance/exemptions";
import {
  formatEcuadorDate,
  formatEcuadorDateKey,
  formatEcuadorMonthKey,
  formatEcuadorTime,
  makeEcuadorDate,
  setEcuadorTime,
} from "@/lib/datetime/ecuador";
import connectToDatabase from "@/lib/db/mongodb";
import { buildGeneratedDays } from "@/lib/planning/scheduleAssignments";
import AttendanceDayDecision from "@/models/AttendanceDayDecision";
import { parseMonthKey } from "@/lib/planning/holidays";
import AttendancePunch from "@/models/AttendancePunch";
import BaseScheduleTemplate from "@/models/BaseScheduleTemplate";
import Employee from "@/models/Employee";
import Holiday from "@/models/Holiday";
import LaborRuleConfig from "@/models/LaborRuleConfig";
import ScheduleAssignment from "@/models/ScheduleAssignment";
import VacationRequest from "@/models/VacationRequest";

const REGULAR_DAY_MINUTES = 8 * 60;
const MIN_TWO_PUNCH_SPAN_MINUTES = 60;
const MIN_REAL_LUNCH_MINUTES = 5;
const MAX_REAL_LUNCH_MINUTES = 180;
const VARIABLE_SCHEDULE_AREA_CODES = new Set(["ALM", "BOD"]);
const WEEKDAY_LABEL_FORMATTER = new Intl.DateTimeFormat("es-EC", {
  weekday: "short",
  timeZone: "America/Guayaquil",
});

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

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function moneyLabel(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function buildDailyPay(day, hourlyRate, multipliers = {}) {
  const supplementaryMultiplier = Number(multipliers.supplementaryMultiplier) || 1.5;
  const extraordinaryMultiplier = Number(multipliers.extraordinaryMultiplier) || 2;
  const items = [];

  function addItem(label, minutes, multiplier = 1, sign = 1) {
    const safeMinutes = Math.max(0, Number(minutes) || 0);
    if (!safeMinutes) return;

    const amount = (safeMinutes / 60) * hourlyRate * multiplier * sign;
    items.push({
      label,
      minutes: safeMinutes,
      minutesLabel: minutesLabel(safeMinutes),
      multiplier,
      rawAmount: amount,
      amount: money(amount),
      amountLabel: moneyLabel(amount),
      isDeduction: sign < 0,
    });
  }

  const isWorkedHoliday =
    day.dayType === "holiday" &&
    ((Number(day.punchCount) || 0) > 0 || (Number(day.extraordinaryMinutes) || 0) > 0);

  if (!isWorkedHoliday) {
    addItem("Laboral", day.regularWorkedMinutes, 1);
  }

  addItem("Suplementaria", day.supplementaryMinutes, supplementaryMultiplier);
  addItem("Extraordinaria", day.extraordinaryMinutes, extraordinaryMultiplier);
  addItem("Atraso", day.lateMinutes, 1, -1);

  const total = items.reduce((sum, item) => sum + item.rawAmount, 0);

  return {
    items,
    rawTotal: total,
    total: money(total),
    totalLabel: moneyLabel(total),
  };
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

function isPlannedPaidDay(day) {
  return ["workday", "weekend_overtime", "holiday", "vacation"].includes(day?.dayType);
}

function isWeekendDateKey(dateKey) {
  const day = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();

  return day === 0 || day === 6;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function monthKeyFromDateKey(dateKey) {
  return String(dateKey || "").slice(0, 7);
}

function weekStartKey(dateKey) {
  const day = new Date(`${dateKey}T12:00:00.000Z`);
  const dayOfWeek = day.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = addDays(day, -daysSinceMonday);

  return monday.toISOString().slice(0, 10);
}

function getWeekContextRange(monthStart, nextMonthStart) {
  const startKey = formatEcuadorDateKey(monthStart);
  const lastMonthDate = addDays(nextMonthStart, -1);
  const lastKey = formatEcuadorDateKey(lastMonthDate);
  const startDayOfWeek = new Date(`${startKey}T12:00:00.000Z`).getUTCDay();
  const lastDayOfWeek = new Date(`${lastKey}T12:00:00.000Z`).getUTCDay();
  const daysSinceMonday = (startDayOfWeek + 6) % 7;
  const daysUntilNextMonday = lastDayOfWeek === 0 ? 1 : 8 - lastDayOfWeek;

  return {
    contextStart: addDays(monthStart, -daysSinceMonday),
    contextEnd: addDays(lastMonthDate, daysUntilNextMonday),
  };
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
  const authorizedSupplementaryMinutes = Math.max(0, Number(day.authorizedExtraMinutes) || 0);
  const plannedRegularMinutes = day.dayType === "workday"
    ? Math.min(scheduledWorkedMinutes, REGULAR_DAY_MINUTES)
    : 0;
  const plannedSupplementaryMinutes = day.dayType === "workday"
    ? Math.min(Math.max(0, scheduledWorkedMinutes - plannedRegularMinutes), authorizedSupplementaryMinutes)
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

function buildReferenceDaysInRange(contextStart, contextEnd, holidayDateKeys = new Set()) {
  const days = [];

  for (let date = contextStart; date < contextEnd; date = addDays(date, 1)) {
    const dateKey = formatEcuadorDateKey(date);

    days.push({
      dateKey,
      label: WEEKDAY_LABEL_FORMATTER.format(date).replace(".", ""),
      dayType: holidayDateKeys.has(dateKey) ? "holiday" : "off_day",
      startTime: "",
      endTime: "",
      lunchDurationMinutes: 0,
      authorizedExtraMinutes: 0,
      graceMinutes: null,
      source: "calendar",
    });
  }

  return days;
}

function mergeReferenceDaysWithAssignment(referenceDays, assignment) {
  const assignmentDaysByDate = new Map(
    (assignment?.generatedDays || []).map((day) => [day.dateKey, day]),
  );

  return referenceDays.map((referenceDay) => {
    const assignmentDay = assignmentDaysByDate.get(referenceDay.dateKey) || {};

    if (referenceDay.dayType === "holiday") {
      return {
        ...referenceDay,
        dayOfWeek: assignmentDay.dayOfWeek ?? referenceDay.dayOfWeek,
        label: assignmentDay.label || referenceDay.label,
        graceMinutes: assignmentDay.graceMinutes ?? referenceDay.graceMinutes,
        source: "holiday",
      };
    }

    return {
      ...referenceDay,
      ...assignmentDay,
    };
  });
}

function buildFixedScheduleFallbackAssignments({ employees = [], templates = [], monthKeys = [], holidays = [] }) {
  const templatesByRole = new Map();
  const holidaysByMonth = new Map();
  const assignments = [];

  templates.forEach((template) => {
    const areaCode = String(template.areaCode || "").trim().toUpperCase();
    const roleCode = String(template.roleCode || "").trim().toUpperCase();

    if (!areaCode || !roleCode || VARIABLE_SCHEDULE_AREA_CODES.has(areaCode)) {
      return;
    }

    const key = `${areaCode}|${roleCode}`;

    if (!templatesByRole.has(key)) {
      templatesByRole.set(key, template);
    }
  });

  holidays.forEach((holiday) => {
    const holidayMonthKey = monthKeyFromDateKey(holiday.dateKey);

    if (!holidaysByMonth.has(holidayMonthKey)) {
      holidaysByMonth.set(holidayMonthKey, []);
    }

    holidaysByMonth.get(holidayMonthKey).push(holiday);
  });

  employees.forEach((employee) => {
    const areaCode = String(employee.areaCode || "").trim().toUpperCase();
    const roleCode = String(employee.roleCode || "").trim().toUpperCase();
    const template = templatesByRole.get(`${areaCode}|${roleCode}`);

    if (!template) {
      return;
    }

    monthKeys.forEach((fallbackMonthKey) => {
      assignments.push({
        monthKey: fallbackMonthKey,
        employee: employee._id,
        employeeName: employee.fullName || "",
        areaCode: template.areaCode || employee.areaCode || "",
        areaName: template.areaName || employee.areaName || "",
        roleCode: template.roleCode || employee.roleCode || "",
        roleName: template.roleName || employee.roleName || "",
        template: template._id,
        templateName: template.name || "",
        rotationGroup: template.rotationGroup || "",
        generatedDays: buildGeneratedDays(fallbackMonthKey, template, holidaysByMonth.get(fallbackMonthKey) || []),
        weeklyPlan: [],
        source: "fixed_template",
      });
    });
  });

  return assignments;
}

function buildVacationDateKeysByEmployee(vacations = []) {
  const byEmployee = new Map();

  vacations.forEach((vacation) => {
    const employeeId = toId(vacation.employee);
    const startKey = vacation.startDateKey;
    const endKey = vacation.endDateKey;

    if (!employeeId || !startKey || !endKey) return;
    if (!byEmployee.has(employeeId)) byEmployee.set(employeeId, new Set());

    const keys = byEmployee.get(employeeId);

    for (let date = new Date(`${startKey}T12:00:00.000Z`); formatEcuadorDateKey(date) <= endKey; date = addDays(date, 1)) {
      keys.add(formatEcuadorDateKey(date));
    }
  });

  return byEmployee;
}

function applyVacationDay(day, vacationDateKeys = new Set()) {
  if (!vacationDateKeys.has(day.dateKey)) return day;
  if (day.dayType === "holiday" || day.dayType === "off_day") return day;

  return {
    ...day,
    dayType: "vacation",
    source: "vacation",
  };
}

function countBaseLaborDays(referenceDays) {
  return referenceDays.filter((day) => !isWeekendDateKey(day.dateKey)).length;
}

function cleanPayrollTags(tags) {
  return tags.filter((tag) =>
    !["Suplementaria", "Suplementarias adicionales", "Extraordinaria", "Todo autorizado"].includes(tag),
  );
}

function hasAssignedScheduleDay(day) {
  return day?.source !== "calendar";
}

function isRestOrWeekendDay(day) {
  return hasAssignedScheduleDay(day) && day.dayType === "off_day";
}

function hasWorkWithoutScheduleTag(day) {
  const tags = day?.tags || [];

  return tags.includes("Trabajo sin horario");
}

function buildDayDecisionMap(decisions = []) {
  return new Map(decisions.map((decision) => [`${toId(decision.employee)}|${decision.dateKey}`, decision]));
}

function applyDayDecision(day, decision) {
  const policy = day.payrollPolicy || {};
  const detectedSupplementaryMinutes = policy.appliesSupplementaryHours === false
    ? 0
    : Math.max(Number(day.supplementaryMinutes) || 0, Number(decision?.detectedSupplementaryMinutes) || 0);
  const detectedExtraordinaryMinutes = policy.appliesExtraordinaryHours === false
    ? 0
    : Math.max(Number(day.extraordinaryMinutes) || 0, Number(decision?.detectedExtraordinaryMinutes) || 0);
  const hasAuthorizableTime = detectedSupplementaryMinutes > 0 || detectedExtraordinaryMinutes > 0;
  const plannedSupplementaryMinutes = Math.min(
    detectedSupplementaryMinutes,
    Math.max(0, (Number(day.plannedSupplementaryMinutes) || 0) - (Number(day.lunchOverageRemainderMinutes) || 0)),
  );
  const plannedExtraordinaryMinutes = Math.min(
    detectedExtraordinaryMinutes,
    Math.max(0, day.dayType === "holiday" && (Number(day.punchCount) || 0) > 0
      ? REGULAR_DAY_MINUTES
      : day.dayType === "weekend_overtime"
        ? Number(day.scheduledWorkedMinutes) || 0
        : Number(day.plannedExtraordinaryMinutes) || 0),
  );

  if (!hasAuthorizableTime) {
    return {
      ...day,
      detectedSupplementaryMinutes,
      detectedSupplementaryLabel: "--",
      detectedExtraordinaryMinutes,
      detectedExtraordinaryLabel: "--",
      authorization: null,
    };
  }

  const effectiveDecision = decision || {
    decision: "planned",
    authorizedSupplementaryMinutes: plannedSupplementaryMinutes,
    authorizedExtraordinaryMinutes: plannedExtraordinaryMinutes,
    note: "",
    decidedBy: "",
  };

  const authorizedSupplementaryMinutes = effectiveDecision.decision === "planned"
    ? plannedSupplementaryMinutes
    : Math.min(
      detectedSupplementaryMinutes,
      Math.max(0, Number(effectiveDecision.authorizedSupplementaryMinutes) || 0),
    );
  const authorizedExtraordinaryMinutes = effectiveDecision.decision === "planned"
    ? plannedExtraordinaryMinutes
    : Math.min(
      detectedExtraordinaryMinutes,
      Math.max(0, Number(effectiveDecision.authorizedExtraordinaryMinutes) || 0),
    );
  const adjustedTags = cleanPayrollTags(day.tags || []);
  const hasUnauthorizedSupplementaryTime = authorizedSupplementaryMinutes < detectedSupplementaryMinutes;
  const hasUnauthorizedExtraordinaryTime = authorizedExtraordinaryMinutes < detectedExtraordinaryMinutes;
  const hasUnauthorizedExtraTime = hasUnauthorizedSupplementaryTime || hasUnauthorizedExtraordinaryTime;

  if (effectiveDecision.decision === "discount_day") {
    return {
      ...day,
      tags: [...adjustedTags, "Dia descontado"],
      regularWorkedMinutes: 0,
      regularWorkedLabel: "--",
      supplementaryMinutes: 0,
      supplementaryLabel: "--",
      extraordinaryMinutes: 0,
      extraordinaryLabel: "--",
      detectedSupplementaryMinutes,
      detectedSupplementaryLabel: detectedSupplementaryMinutes ? minutesLabel(detectedSupplementaryMinutes) : "--",
      detectedExtraordinaryMinutes,
      detectedExtraordinaryLabel: detectedExtraordinaryMinutes ? minutesLabel(detectedExtraordinaryMinutes) : "--",
      authorization: {
        decision: "discount_day",
        statusLabel: "Dia descontado",
        authorizedSupplementaryMinutes: 0,
        authorizedExtraordinaryMinutes: 0,
        note: effectiveDecision.note || "",
        decidedBy: effectiveDecision.decidedBy || "",
        isSaved: Boolean(decision),
      },
    };
  }

  if (hasUnauthorizedSupplementaryTime) adjustedTags.push("Suplementarias adicionales");
  if (authorizedExtraordinaryMinutes > 0) adjustedTags.push("Extraordinaria");
  const hasIssue = adjustedTags.some((tag) =>
    !["Extraordinaria"].includes(tag),
  );

  return {
    ...day,
    tags: adjustedTags,
    hasIssue,
    supplementaryMinutes: authorizedSupplementaryMinutes,
    supplementaryLabel: authorizedSupplementaryMinutes ? minutesLabel(authorizedSupplementaryMinutes) : "--",
    extraordinaryMinutes: authorizedExtraordinaryMinutes,
    extraordinaryLabel: authorizedExtraordinaryMinutes ? minutesLabel(authorizedExtraordinaryMinutes) : "--",
    detectedSupplementaryMinutes,
    detectedSupplementaryLabel: detectedSupplementaryMinutes ? minutesLabel(detectedSupplementaryMinutes) : "--",
    detectedExtraordinaryMinutes,
    detectedExtraordinaryLabel: detectedExtraordinaryMinutes ? minutesLabel(detectedExtraordinaryMinutes) : "--",
    authorization: {
      decision: effectiveDecision.decision || "custom",
      statusLabel: effectiveDecision.decision === "none"
        ? "No pagado"
        : effectiveDecision.decision === "full"
          ? "Todo autorizado"
          : effectiveDecision.decision === "planned"
            ? hasUnauthorizedExtraTime
              ? "Según plan"
              : "Planificado"
            : "Ajustado",
      authorizedSupplementaryMinutes,
      authorizedExtraordinaryMinutes,
      note: effectiveDecision.note || "",
      decidedBy: effectiveDecision.decidedBy || "",
      isSaved: Boolean(decision),
      hasUnauthorizedSupplementaryTime,
      hasUnauthorizedExtraordinaryTime,
    },
  };
}

function applyMonthlyHourTarget(days, regularTargetMinutes) {
  let remainingRegularMinutes = Math.max(0, Number(regularTargetMinutes) || 0);

  return days.map((day) => {
    const nextDay = {
      ...day,
      tags: cleanPayrollTags(day.tags || []),
      regularWorkedMinutes: 0,
      regularWorkedLabel: "--",
      supplementaryMinutes: 0,
      supplementaryLabel: "--",
      extraordinaryMinutes: 0,
      extraordinaryLabel: "--",
      additionalSupplementaryMinutes: Number(day.additionalSupplementaryMinutes) || 0,
      additionalSupplementaryLabel: day.additionalSupplementaryMinutes ? minutesLabel(day.additionalSupplementaryMinutes) : "--",
    };
    const workedMinutes = Number(day.workedMinutes) || 0;
    const policy = day.payrollPolicy || {};
    const appliesSupplementaryHours = policy.appliesSupplementaryHours !== false;
    const appliesExtraordinaryHours = policy.appliesExtraordinaryHours !== false;

    if (day.dayType === "holiday") {
      nextDay.plannedRegularMinutes = REGULAR_DAY_MINUTES;
      nextDay.plannedRegularLabel = minutesLabel(REGULAR_DAY_MINUTES);
      const regularMinutes = Math.min(REGULAR_DAY_MINUTES, remainingRegularMinutes);
      remainingRegularMinutes -= regularMinutes;
      nextDay.regularWorkedMinutes = regularMinutes;
      nextDay.regularWorkedLabel = regularMinutes ? minutesLabel(regularMinutes) : "--";

      if (workedMinutes > 0 && appliesExtraordinaryHours) {
        nextDay.extraordinaryMinutes = workedMinutes;
        nextDay.extraordinaryLabel = minutesLabel(workedMinutes);
        nextDay.tags = [...nextDay.tags, "Extraordinaria"];
      }

      return nextDay;
    }

    if (day.dayType === "vacation") {
      nextDay.plannedRegularMinutes = REGULAR_DAY_MINUTES;
      nextDay.plannedRegularLabel = minutesLabel(REGULAR_DAY_MINUTES);
      const regularMinutes = Math.min(REGULAR_DAY_MINUTES, remainingRegularMinutes);
      remainingRegularMinutes -= regularMinutes;
      nextDay.regularWorkedMinutes = regularMinutes;
      nextDay.regularWorkedLabel = regularMinutes ? minutesLabel(regularMinutes) : "--";
      return nextDay;
    }

    if (!workedMinutes) {
      return nextDay;
    }

    if (isRestOrWeekendDay(day)) {
      if (!appliesExtraordinaryHours) {
        return nextDay;
      }

      nextDay.extraordinaryMinutes = workedMinutes;
      nextDay.extraordinaryLabel = minutesLabel(workedMinutes);
      nextDay.tags = [...nextDay.tags.filter((tag) => tag !== "Trabajo sin horario"), "Extraordinaria"];
      return nextDay;
    }

    if (hasWorkWithoutScheduleTag(nextDay)) {
      nextDay.hasIssue = true;
      return nextDay;
    }

    const regularCandidateMinutes = Math.min(workedMinutes, REGULAR_DAY_MINUTES);
    const regularMinutes = Math.min(regularCandidateMinutes, remainingRegularMinutes);
    const afterTargetMinutes = regularCandidateMinutes - regularMinutes;
    const overDailyMinutes = Math.max(0, workedMinutes - regularCandidateMinutes);

    remainingRegularMinutes -= regularMinutes;
    nextDay.regularWorkedMinutes = regularMinutes;
    nextDay.regularWorkedLabel = regularMinutes ? minutesLabel(regularMinutes) : "--";

    nextDay.supplementaryMinutes = appliesSupplementaryHours ? afterTargetMinutes + overDailyMinutes : 0;
    nextDay.supplementaryLabel = nextDay.supplementaryMinutes ? minutesLabel(nextDay.supplementaryMinutes) : "--";

    nextDay.hasIssue = nextDay.tags.some((tag) =>
      !["Extraordinaria"].includes(tag),
    );

    return nextDay;
  });
}

function weeklyRegularTargetMinutes(days) {
  return countBaseLaborDays(days) * REGULAR_DAY_MINUTES;
}

function applyWeeklyHourTargets(days) {
  const weekGroups = new Map();

  days.forEach((day) => {
    const key = weekStartKey(day.dateKey);

    if (!weekGroups.has(key)) {
      weekGroups.set(key, []);
    }

    weekGroups.get(key).push(day);
  });

  const byDate = new Map();

  [...weekGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([, weekDays]) => {
      const classifiedWeekDays = applyMonthlyHourTarget(
        [...weekDays].sort((left, right) => left.dateKey.localeCompare(right.dateKey)),
        weeklyRegularTargetMinutes(weekDays),
      );

      classifiedWeekDays.forEach((day) => {
        byDate.set(day.dateKey, day);
      });
    });

  return days.map((day) => byDate.get(day.dateKey) || day);
}

function compareDay(day, punches, laborRules, employee = {}) {
  const sortedPunches = [...punches].sort((left, right) => left.punchedAt - right.punchedAt);
  const punchCount = sortedPunches.length;
  const isWorkingDay = isPlannedWorkDay(day);
  const payrollPolicy = attendancePayrollPolicy(employee, laborRules);
  const scheduleAffectsSalary = payrollPolicy.scheduleAffectsSalary !== false;
  const shouldUsePlannedAttendance = !scheduleAffectsSalary && isWorkingDay && punchCount === 0;
  const shouldSuppressScheduleIssues = !scheduleAffectsSalary;
  const shouldIgnorePunchesForPayroll =
    !payrollPolicy.appliesSupplementaryHours &&
    !payrollPolicy.appliesExtraordinaryHours &&
    !isWorkingDay;
  const isWeekendOrHoliday = isWeekendDateKey(day.dateKey) || day?.dayType === "holiday";
  const hasLunch = isWorkingDay && Number(day?.lunchDurationMinutes) > 0;
  const expectedPunches = isWorkingDay ? (hasLunch ? 4 : 2) : 0;
  const scheduleStart = isWorkingDay ? combineDateAndTime(day.dateKey, day.startTime) : null;
  const scheduleEnd = isWorkingDay ? combineDateAndTime(day.dateKey, day.endTime) : null;
  const graceMinutes = Number(day?.graceMinutes ?? laborRules?.defaultGraceMinutes ?? 10) || 0;
  const plannedMinutes = resolveScheduledMinutes(day);
  const firstPunch = sortedPunches[0] || null;
  const lastPunch = sortedPunches[punchCount - 1] || null;
  const twoPunchSpanMinutes = punchCount === 2 && firstPunch && lastPunch
    ? Math.max(0, Math.round((lastPunch.punchedAt - firstPunch.punchedAt) / 60000))
    : null;
  const hasInsufficientTwoPunchSpan = twoPunchSpanMinutes !== null && twoPunchSpanMinutes < MIN_TWO_PUNCH_SPAN_MINUTES;
  const hasUnusablePunchesForPayroll =
    punchCount === 0 ||
    punchCount === 1 ||
    punchCount % 2 !== 0 ||
    hasInsufficientTwoPunchSpan;
  const tags = [];
  let workedMinutes = 0;
  let regularWorkedMinutes = 0;
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let supplementaryMinutes = 0;
  let extraordinaryMinutes = 0;
  let additionalSupplementaryMinutes = 0;
  let actualLunchMinutes = null;
  let lunchOverageMinutes = 0;
  let lunchOverageRemainderMinutes = 0;

  actualLunchMinutes = resolveActualLunchMinutes(sortedPunches);

  if (firstPunch && lastPunch && !hasInsufficientTwoPunchSpan) {
    const countedStart = scheduleStart && firstPunch.punchedAt < scheduleStart
      ? scheduleStart
      : firstPunch.punchedAt;
    const grossMinutes = lastPunch.punchedAt > countedStart
      ? Math.max(0, Math.round((lastPunch.punchedAt - countedStart) / 60000))
      : 0;
    const scheduledLunchMinutes = hasLunch ? Number(day.lunchDurationMinutes) || 0 : 0;
    const lunchDiscount = Math.max(actualLunchMinutes || 0, scheduledLunchMinutes);
    lunchOverageMinutes = Math.max(0, (actualLunchMinutes || 0) - scheduledLunchMinutes);
    workedMinutes = Math.max(0, grossMinutes - lunchDiscount);
  }

  if (shouldUsePlannedAttendance || (!scheduleAffectsSalary && isWorkingDay && hasUnusablePunchesForPayroll)) {
    workedMinutes = plannedMinutes.plannedRegularMinutes + plannedMinutes.plannedSupplementaryMinutes;
    regularWorkedMinutes = workedMinutes;
    actualLunchMinutes = null;
  }

  if (!scheduleAffectsSalary && isWorkingDay && workedMinutes > 0) {
    workedMinutes = Math.max(
      workedMinutes,
      plannedMinutes.plannedRegularMinutes + plannedMinutes.plannedSupplementaryMinutes,
    );
  }

  if (shouldIgnorePunchesForPayroll) {
    workedMinutes = 0;
    actualLunchMinutes = null;
    lunchOverageMinutes = 0;
    lunchOverageRemainderMinutes = 0;
  }

  if (isWorkingDay && punchCount === 0 && !shouldUsePlannedAttendance && !shouldSuppressScheduleIssues) {
    tags.push("Sin picadas");
  }

  if (
    isWorkingDay &&
    punchCount > 0 &&
    (punchCount < expectedPunches || punchCount % 2 !== 0) &&
    !shouldUsePlannedAttendance &&
    !shouldSuppressScheduleIssues
  ) {
    tags.push("Picadas incompletas");
  }

  if (punchCount === 2 && hasInsufficientTwoPunchSpan && !shouldUsePlannedAttendance && !shouldSuppressScheduleIssues) {
    tags.push("Picadas insuficientes");
  }

  if (isWorkingDay && punchCount > expectedPunches && !shouldUsePlannedAttendance && !shouldSuppressScheduleIssues) {
    tags.push("Picadas adicionales");
  }

  if (!isWorkingDay && day?.dayType !== "holiday" && punchCount > 0 && !shouldUsePlannedAttendance && !shouldIgnorePunchesForPayroll) {
    tags.push("Trabajo sin horario");
  }

  if (isWorkingDay && scheduleStart && firstPunch && firstPunch.punchedAt > scheduleStart && !shouldUsePlannedAttendance && !hasInsufficientTwoPunchSpan && scheduleAffectsSalary) {
    const rawLateMinutes = Math.max(0, Math.round((firstPunch.punchedAt - scheduleStart) / 60000));
    lateMinutes = rawLateMinutes > graceMinutes ? rawLateMinutes : 0;
    if (lateMinutes > 0) tags.push("Atraso");
  }

  if (isWorkingDay && scheduleEnd && lastPunch && lastPunch.punchedAt < scheduleEnd && !shouldUsePlannedAttendance && !hasInsufficientTwoPunchSpan && scheduleAffectsSalary) {
    earlyLeaveMinutes = Math.max(0, Math.round((scheduleEnd - lastPunch.punchedAt) / 60000));
    if (earlyLeaveMinutes > 0) tags.push("Salida anticipada");
  }

  if (isWorkingDay && scheduleEnd && lastPunch && lastPunch.punchedAt > scheduleEnd && !shouldUsePlannedAttendance && !hasInsufficientTwoPunchSpan && payrollPolicy.appliesSupplementaryHours) {
    const rawAdditionalSupplementaryMinutes = Math.max(0, Math.round((lastPunch.punchedAt - scheduleEnd) / 60000));
    additionalSupplementaryMinutes = Math.max(0, rawAdditionalSupplementaryMinutes - lunchOverageMinutes);
    lunchOverageRemainderMinutes = Math.max(0, lunchOverageMinutes - rawAdditionalSupplementaryMinutes);
  } else {
    lunchOverageRemainderMinutes = lunchOverageMinutes;
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
    source: day.source || "calendar",
    scheduleLabel: buildScheduleLabel(day),
    startTime: day.startTime || "",
    endTime: day.endTime || "",
    lunchDurationMinutes: Number(day.lunchDurationMinutes) || 0,
    actualLunchMinutes,
    actualLunchLabel: actualLunchMinutes === null ? "--" : minutesLabel(actualLunchMinutes),
    lunchOverageMinutes,
    lunchOverageLabel: lunchOverageMinutes ? minutesLabel(lunchOverageMinutes) : "--",
    lunchOverageRemainderMinutes,
    lunchOverageRemainderLabel: lunchOverageRemainderMinutes ? minutesLabel(lunchOverageRemainderMinutes) : "--",
    authorizedExtraMinutes: Number(day.authorizedExtraMinutes) || 0,
    graceMinutes,
    scheduledWorkedMinutes: plannedMinutes.scheduledWorkedMinutes,
    plannedRegularMinutes: plannedMinutes.plannedRegularMinutes,
    plannedSupplementaryMinutes: plannedMinutes.plannedSupplementaryMinutes,
    payrollPolicy,
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
    plannedDaysWithPunches: 0,
    plannedRegularMinutes: 0,
    plannedSupplementaryMinutes: 0,
    plannedExtraordinaryMinutes: 0,
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
    const { contextStart, contextEnd } = getWeekContextRange(start, end);
    const employeeQuery = {
      $or: [
        { isActive: { $ne: false } },
        { terminationDate: { $gte: start } },
      ],
    };

    if (branchCode) {
      employeeQuery.branchCode = branchCode;
    }

    if (areaCode) {
      employeeQuery.areaCode = areaCode;
    }

    if (roleCode) {
      employeeQuery.roleCode = roleCode;
    }

    if (employeeId) {
      employeeQuery._id = employeeId;
    }

    const [employees, laborRules, holidays, vacations] = await Promise.all([
      Employee.find(employeeQuery).sort({ branchName: 1, areaName: 1, roleName: 1, fullName: 1 }).lean(),
      LaborRuleConfig.findOne({ key: "default" }).lean(),
      Holiday.find({
        date: {
          $gte: contextStart,
          $lt: contextEnd,
        },
      }).lean(),
      VacationRequest.find({
        status: "scheduled",
        startDate: { $lt: contextEnd },
        endDate: { $gte: contextStart },
      }).lean(),
    ]);
    const employeeIds = employees.map((employee) => employee._id);
    const contextMonthKeys = new Set();
    const contextCursorEnd = contextEnd;

    for (let date = contextStart; date < contextCursorEnd; date = addDays(date, 1)) {
      contextMonthKeys.add(monthKeyFromDateKey(formatEcuadorDateKey(date)));
    }

    const [manualAssignments, fixedScheduleTemplates] = employeeIds.length
      ? await Promise.all([
          ScheduleAssignment.find({
            employee: { $in: employeeIds },
            monthKey: { $in: [...contextMonthKeys] },
          }).lean(),
          BaseScheduleTemplate.find({
            isActive: { $ne: false },
            areaCode: { $nin: [...VARIABLE_SCHEDULE_AREA_CODES] },
          }).lean(),
        ])
      : [[], []];
    const fallbackAssignments = buildFixedScheduleFallbackAssignments({
      employees,
      templates: fixedScheduleTemplates,
      monthKeys: [...contextMonthKeys],
      holidays,
    });
    const assignments = [...fallbackAssignments, ...manualAssignments];
    const punches = employeeIds.length
      ? await AttendancePunch.find({
          employee: { $in: employeeIds },
          punchedAt: {
            $gte: contextStart,
            $lt: contextEnd,
          },
        }).sort({ punchedAt: 1 }).lean()
      : [];
    const assignmentsByEmployeeMonth = new Map(
      assignments.map((assignment) => [`${toId(assignment.employee)}|${assignment.monthKey}`, assignment]),
    );
    const dayDecisions = employeeIds.length
      ? await AttendanceDayDecision.find({
          employee: { $in: employeeIds },
          date: {
            $gte: start,
            $lt: end,
          },
        }).lean()
      : [];
    const dayDecisionsByEmployeeDate = buildDayDecisionMap(dayDecisions);
    const vacationDateKeysByEmployee = buildVacationDateKeysByEmployee(vacations);
    const punchesByEmployeeDate = new Map();

    punches.forEach((punch) => {
      const key = `${toId(punch.employee)}|${formatEcuadorDateKey(punch.punchedAt)}`;

      if (!punchesByEmployeeDate.has(key)) {
        punchesByEmployeeDate.set(key, []);
      }

      punchesByEmployeeDate.get(key).push(punch);
    });

    const holidayDateKeys = new Set(holidays.map((holiday) => holiday.dateKey));
    const referenceDays = buildReferenceDaysInRange(contextStart, contextEnd, holidayDateKeys);
    const visibleReferenceDays = referenceDays.filter((day) => monthKeyFromDateKey(day.dateKey) === monthKey);
    const baseLaborDays = countBaseLaborDays(visibleReferenceDays);
    const regularTargetMinutes = baseLaborDays * REGULAR_DAY_MINUTES;
    const rows = employees.map((employee) => {
      const employeeKey = toId(employee);
      const vacationDateKeys = vacationDateKeysByEmployee.get(employeeKey) || new Set();
      const comparableDays = referenceDays.map((referenceDay) => {
        const assignment = assignmentsByEmployeeMonth.get(`${employeeKey}|${monthKeyFromDateKey(referenceDay.dateKey)}`);

        return applyVacationDay(mergeReferenceDaysWithAssignment([referenceDay], assignment)[0], vacationDateKeys);
      });
      const comparedDays = comparableDays.map((day) =>
        compareDay(day, punchesByEmployeeDate.get(`${employeeKey}|${day.dateKey}`) || [], laborRules, employee),
      );
      const visibleDays = comparedDays.filter((day) => monthKeyFromDateKey(day.dateKey) === monthKey);
      const classifiedDays = applyMonthlyHourTarget(visibleDays, regularTargetMinutes);
      const days = classifiedDays.map((day) =>
        applyDayDecision(day, dayDecisionsByEmployeeDate.get(`${employeeKey}|${day.dateKey}`)),
      );
      const assignment = assignmentsByEmployeeMonth.get(`${employeeKey}|${monthKey}`);
      const summary = days.reduce((totals, day) => {
        if (isPlannedPaidDay(day)) {
          totals.plannedDays += 1;
          if (day.punchCount > 0) totals.plannedDaysWithPunches += 1;
        }
        if (day.punchCount > 0) totals.daysWithPunches += 1;
        if (day.tags.includes("Sin picadas")) totals.absentDays += 1;
        if (day.tags.includes("Picadas incompletas") || day.tags.includes("Picadas insuficientes")) {
          totals.missingPunchDays += 1;
        }
        if (day.lateMinutes > 0) totals.lateDays += 1;
        if (day.earlyLeaveMinutes > 0) totals.earlyLeaveDays += 1;
        if (day.tags.includes("Picadas adicionales")) totals.extraPunchDays += 1;
        if (day.tags.includes("Trabajo sin horario")) {
          totals.unplannedWorkDays += 1;
        }
        if (day.supplementaryMinutes > 0 || day.additionalSupplementaryMinutes > 0 || day.extraordinaryMinutes > 0) {
          totals.extraDays += 1;
        }
        if (day.hasIssue) totals.issueDays += 1;

        totals.plannedRegularMinutes += day.plannedRegularMinutes;
        totals.plannedSupplementaryMinutes += day.plannedSupplementaryMinutes;
        totals.plannedExtraordinaryMinutes += day.dayType === "weekend_overtime" ? day.scheduledWorkedMinutes : 0;
        totals.lateMinutes += day.lateMinutes;
        totals.earlyLeaveMinutes += day.earlyLeaveMinutes;
        totals.regularWorkedMinutes += day.regularWorkedMinutes;
        totals.supplementaryMinutes += day.supplementaryMinutes;
        totals.extraordinaryMinutes += day.extraordinaryMinutes;
        totals.unplannedExtraMinutes += day.additionalSupplementaryMinutes;
        totals.additionalSupplementaryMinutes += day.additionalSupplementaryMinutes;
        return totals;
      }, emptyEmployeeSummary());
      const salary = Number(employee.salary) || 0;
      const hourlyDivisor = Math.max(regularTargetMinutes / 60, REGULAR_DAY_MINUTES / 60);
      const hourlyRate = hourlyDivisor > 0 ? salary / hourlyDivisor : 0;
      const supplementaryMultiplier = Number(laborRules?.supplementaryMultiplier) || 1.5;
      const extraordinaryMultiplier = Number(laborRules?.extraordinaryMultiplier) || 2;
      const daysWithPay = days.map((day) => ({
        ...day,
        pay: buildDailyPay(day, hourlyRate, { supplementaryMultiplier, extraordinaryMultiplier }),
      }));
      const salaryExpected = salary;
      const salaryProjected = daysWithPay.reduce((total, day) => total + (Number(day.pay.rawTotal) || 0), 0);

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
          baseLaborDays,
          regularTargetMinutes,
          regularTargetLabel: minutesLabel(regularTargetMinutes),
          regularDeficitMinutes: Math.max(0, regularTargetMinutes - summary.regularWorkedMinutes),
          regularDeficitLabel: minutesLabel(Math.max(0, regularTargetMinutes - summary.regularWorkedMinutes)),
          plannedRegularLabel: minutesLabel(summary.plannedRegularMinutes),
          plannedSupplementaryLabel: minutesLabel(summary.plannedSupplementaryMinutes),
          plannedExtraordinaryLabel: minutesLabel(summary.plannedExtraordinaryMinutes),
          salaryExpected: money(salaryExpected),
          salaryExpectedLabel: moneyLabel(salaryExpected),
          salaryProjected: money(salaryProjected),
          salaryProjectedLabel: moneyLabel(salaryProjected),
          hourlyRate: money(hourlyRate),
          hourlyRateRaw: hourlyRate,
          hourlyRateLabel: moneyLabel(hourlyRate),
          supplementaryMultiplier,
          extraordinaryMultiplier,
          regularWorkedLabel: minutesLabel(summary.regularWorkedMinutes),
          supplementaryLabel: minutesLabel(summary.supplementaryMinutes),
          extraordinaryLabel: minutesLabel(summary.extraordinaryMinutes),
          unplannedExtraLabel: minutesLabel(summary.unplannedExtraMinutes),
          additionalSupplementaryLabel: minutesLabel(summary.additionalSupplementaryMinutes),
          lateLabel: minutesLabel(summary.lateMinutes),
          earlyLeaveLabel: minutesLabel(summary.earlyLeaveMinutes),
        },
        days: daysWithPay,
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
        totals.plannedRegularMinutes += row.summary.plannedRegularMinutes;
        totals.plannedSupplementaryMinutes += row.summary.plannedSupplementaryMinutes;
        totals.plannedExtraordinaryMinutes += row.summary.plannedExtraordinaryMinutes;
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
        plannedRegularMinutes: 0,
        plannedSupplementaryMinutes: 0,
        plannedExtraordinaryMinutes: 0,
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
        plannedRegularLabel: minutesLabel(summary.plannedRegularMinutes),
        plannedSupplementaryLabel: minutesLabel(summary.plannedSupplementaryMinutes),
        plannedExtraordinaryLabel: minutesLabel(summary.plannedExtraordinaryMinutes),
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
