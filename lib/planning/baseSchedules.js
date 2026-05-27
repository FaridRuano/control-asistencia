import { DAY_TYPES, WEEK_DAYS } from "@/lib/schedules";

const DAY_TYPE_MAP = new Map(DAY_TYPES.map((item) => [item.value, item]));

export const DEFAULT_TEMPLATE_ROWS = WEEK_DAYS.map((day) => ({
  dayOfWeek: day.dayOfWeek,
  label: day.label,
  dayType: day.dayOfWeek === 0 ? "off_day" : day.dayOfWeek === 6 ? "weekend_overtime" : "workday",
  startTime: day.dayOfWeek === 0 ? "" : "08:00",
  lunchDurationMinutes: day.dayOfWeek === 0 ? 0 : 60,
  hasLunch: day.dayOfWeek !== 0,
  endTime: day.dayOfWeek === 0 ? "" : "18:00",
  authorizedExtraMinutes: day.dayOfWeek === 0 ? 0 : 60,
  graceMinutes: 10,
}));

function isValidTimeString(value) {
  return value === "" || /^\d{2}:\d{2}$/.test(String(value || ""));
}

function normalizeNumber(value, fallback, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

export function normalizeTemplateRow(row) {
  const dayOfWeek = Number(row?.dayOfWeek);
  const dayType = String(row?.dayType || "").trim();
  const typeConfig = DAY_TYPE_MAP.get(dayType);
  const startTime = String(row?.startTime || "").trim();
  const endTime = String(row?.endTime || "").trim();

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error("Dia de la semana invalido.");
  }

  if (!typeConfig) {
    throw new Error("Tipo de dia invalido.");
  }

  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) {
    throw new Error("Las horas deben tener formato HH:mm.");
  }

  if (typeConfig.isWorkingDay && (!startTime || !endTime)) {
    throw new Error("Los dias laborables deben tener entrada y salida.");
  }

  const hasLunch = typeConfig.isWorkingDay ? Boolean(row?.hasLunch) : false;

  return {
    dayOfWeek,
    dayType,
    startTime: typeConfig.isWorkingDay ? startTime : "",
    lunchDurationMinutes: hasLunch
      ? normalizeNumber(row?.lunchDurationMinutes, 60, { min: 0, max: 240 })
      : 0,
    hasLunch,
    endTime: typeConfig.isWorkingDay ? endTime : "",
    authorizedExtraMinutes: typeConfig.isWorkingDay
      ? normalizeNumber(row?.authorizedExtraMinutes, 0, { min: 0, max: 720 })
      : 0,
    graceMinutes: normalizeNumber(row?.graceMinutes, 10, { min: 0, max: 180 }),
  };
}

export function normalizeBaseScheduleTemplatePayload(body, { area, role } = {}) {
  const areaCode = String(body?.areaCode || "").trim();
  const roleCode = String(body?.roleCode || "").trim();
  const name = String(body?.name || "").trim().toUpperCase();
  const rows = Array.isArray(body?.weeklyRows) ? body.weeklyRows : [];

  if (!name) {
    throw new Error("El nombre de la plantilla es obligatorio.");
  }

  if (!areaCode || !roleCode) {
    throw new Error("Debes seleccionar area y rol.");
  }

  if (!area || !role) {
    throw new Error("El area o rol seleccionado no existe.");
  }

  if (rows.length !== 7) {
    throw new Error("La plantilla debe contener los 7 dias de la semana.");
  }

  return {
    name,
    areaCode,
    areaName: area.name,
    roleCode,
    roleName: role.name,
    rotationGroup: String(body?.rotationGroup || "").trim(),
    weeklyRows: rows.map(normalizeTemplateRow),
    notes: String(body?.notes || "").trim(),
    isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
  };
}

export function serializeBaseScheduleTemplate(template) {
  return {
    id: template._id.toString(),
    name: template.name || "",
    areaCode: template.areaCode || "",
    areaName: template.areaName || "",
    roleCode: template.roleCode || "",
    roleName: template.roleName || "",
    rotationGroup: template.rotationGroup || "",
    weeklyRows: (template.weeklyRows || []).map((row) => {
      const day = WEEK_DAYS.find((item) => item.dayOfWeek === row.dayOfWeek);

      return {
        dayOfWeek: row.dayOfWeek,
        label: day?.label || "",
        dayType: row.dayType || "workday",
        startTime: row.startTime || "",
        lunchDurationMinutes: row.lunchDurationMinutes || 0,
        hasLunch: Boolean(row.hasLunch),
        endTime: row.endTime || "",
        authorizedExtraMinutes: row.authorizedExtraMinutes || 0,
        graceMinutes: row.graceMinutes ?? 10,
      };
    }),
    notes: template.notes || "",
    isActive: template.isActive !== false,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}
