import { addDays, format } from "date-fns";

import { makeEcuadorDate } from "@/lib/datetime/ecuador";
import { parseMonthKey } from "@/lib/planning/holidays";
import { WEEK_DAYS } from "@/lib/schedules";

const DAY_LABELS = new Map(WEEK_DAYS.map((day) => [day.dayOfWeek, day.label]));

function toId(value) {
  return value?._id?.toString?.() || value?.toString?.() || "";
}

function getMonthDateKeys(monthKey) {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const startDate = makeEcuadorDate(year, monthIndex, 1);
  const nextMonthDate = makeEcuadorDate(year, monthIndex + 1, 1);
  const dateKeys = [];

  for (let date = startDate; date < nextMonthDate; date = addDays(date, 1)) {
    dateKeys.push(format(date, "yyyy-MM-dd"));
  }

  return dateKeys;
}

function getDayOfWeek(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);

  return date.getDay();
}

function cloneTemplateRow(row) {
  return {
    dayType: row?.dayType || "off_day",
    startTime: row?.startTime || "",
    lunchDurationMinutes: Number(row?.lunchDurationMinutes) || 0,
    endTime: row?.endTime || "",
    authorizedExtraMinutes: Number(row?.authorizedExtraMinutes) || 0,
  };
}

export function buildGeneratedDays(monthKey, template, holidays = []) {
  const rowsByDay = new Map((template?.weeklyRows || []).map((row) => [row.dayOfWeek, cloneTemplateRow(row)]));
  const holidayNamesByDate = new Map(holidays.map((holiday) => [holiday.dateKey, holiday.name]));

  return getMonthDateKeys(monthKey).map((dateKey) => {
    const dayOfWeek = getDayOfWeek(dateKey);
    const baseRow = rowsByDay.get(dayOfWeek) || cloneTemplateRow();
    const holidayName = holidayNamesByDate.get(dateKey);

    if (holidayName) {
      return {
        dateKey,
        dayOfWeek,
        label: DAY_LABELS.get(dayOfWeek) || "",
        dayType: "holiday",
        startTime: "",
        lunchDurationMinutes: 0,
        endTime: "",
        authorizedExtraMinutes: 0,
        source: "holiday",
      };
    }

    return {
      dateKey,
      dayOfWeek,
      label: DAY_LABELS.get(dayOfWeek) || "",
      ...baseRow,
      source: "template",
    };
  });
}

export function summarizeGeneratedDays(days = []) {
  return days.reduce(
    (summary, day) => {
      if (day.dayType === "workday") {
        summary.workdays += 1;
        summary.supplementaryMinutes += Number(day.authorizedExtraMinutes) || 0;
      }

      if (day.dayType === "weekend_overtime") {
        summary.extraordinaryDays += 1;
      }

      if (day.dayType === "holiday") {
        summary.holidays += 1;
      }

      if (day.dayType === "off_day") {
        summary.restDays += 1;
      }

      return summary;
    },
    {
      workdays: 0,
      restDays: 0,
      holidays: 0,
      extraordinaryDays: 0,
      supplementaryMinutes: 0,
    },
  );
}

export function buildAssignmentPayload({ employee, template, monthKey, holidays, notes = "" }) {
  const generatedDays = buildGeneratedDays(monthKey, template, holidays);

  return {
    monthKey,
    employee: employee._id,
    employeeName: employee.fullName || "",
    employeeDni: employee.dni || "",
    branchCode: employee.branchCode || "",
    branchName: employee.branchName || employee.branch || "",
    areaCode: template.areaCode || employee.areaCode || "",
    areaName: template.areaName || employee.areaName || "",
    roleCode: template.roleCode || employee.roleCode || "",
    roleName: template.roleName || employee.roleName || "",
    template: template._id,
    templateName: template.name || "",
    rotationGroup: template.rotationGroup || "",
    generatedDays,
    notes: String(notes || "").trim(),
  };
}

export function serializeScheduleAssignment(assignment) {
  const generatedDays = assignment.generatedDays || [];

  return {
    id: toId(assignment),
    monthKey: assignment.monthKey || "",
    employeeId: toId(assignment.employee),
    employeeName: assignment.employeeName || "",
    employeeDni: assignment.employeeDni || "",
    branchCode: assignment.branchCode || "",
    branchName: assignment.branchName || "",
    areaCode: assignment.areaCode || "",
    areaName: assignment.areaName || "",
    roleCode: assignment.roleCode || "",
    roleName: assignment.roleName || "",
    templateId: toId(assignment.template),
    templateName: assignment.templateName || "",
    rotationGroup: assignment.rotationGroup || "",
    generatedDays,
    summary: summarizeGeneratedDays(generatedDays),
    notes: assignment.notes || "",
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };
}
