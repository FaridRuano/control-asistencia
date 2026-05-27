import { endOfMonth, format, isValid, parse, startOfMonth } from "date-fns";

import { makeEcuadorDate } from "@/lib/datetime/ecuador";

export const EXCEPTION_TYPES = [
  { value: "absence", label: "Ausencia" },
  { value: "sick_leave", label: "Enfermedad" },
  { value: "permission", label: "Permiso" },
  { value: "schedule_change", label: "Cambio de horario" },
  { value: "replacement", label: "Reemplazo" },
  { value: "other", label: "Otro" },
];

export const EXCEPTION_RESOLUTIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "discount_day", label: "Descontar dia" },
  { value: "paid_leave", label: "Permiso pagado" },
  { value: "reschedule", label: "Reprogramar horario" },
  { value: "replacement", label: "Cubierto por reemplazo" },
  { value: "no_action", label: "Sin accion" },
  { value: "other", label: "Otra resolucion" },
];

const TYPE_VALUES = new Set(EXCEPTION_TYPES.map((type) => type.value));
const RESOLUTION_VALUES = new Set(EXCEPTION_RESOLUTIONS.map((resolution) => resolution.value));

function getLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}

export function parseMonthKey(value) {
  const monthKey = String(value || "").trim();

  if (!monthKey) {
    return null;
  }

  const parsed = parse(monthKey, "yyyy-MM", new Date());

  if (!isValid(parsed) || format(parsed, "yyyy-MM") !== monthKey) {
    throw new Error("El mes no es valido.");
  }

  return makeEcuadorDate(parsed.getFullYear(), parsed.getMonth(), 1);
}

export function parseDateKey(value, fieldLabel = "fecha") {
  const dateKey = String(value || "").trim();
  const parsed = parse(dateKey, "yyyy-MM-dd", new Date());

  if (!isValid(parsed) || format(parsed, "yyyy-MM-dd") !== dateKey) {
    throw new Error(`La ${fieldLabel} no es valida.`);
  }

  return {
    dateKey,
    date: makeEcuadorDate(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()),
  };
}

export function buildMonthExceptionQuery(monthKey) {
  const monthDate = parseMonthKey(monthKey);
  const query = { status: { $ne: "void" } };

  if (!monthDate) {
    return query;
  }

  query.date = {
    $gte: startOfMonth(monthDate),
    $lte: endOfMonth(monthDate),
  };

  return query;
}

export function normalizeExceptionPayload(body, employee) {
  if (!employee) {
    throw new Error("Empleado no encontrado.");
  }

  const { date, dateKey } = parseDateKey(body?.dateKey, "fecha de la excepcion");
  const cleanEndDateKey = String(body?.endDateKey || "").trim();
  const endDateData = cleanEndDateKey ? parseDateKey(cleanEndDateKey, "fecha de fin") : null;
  const type = String(body?.type || "").trim();
  const resolution = String(body?.resolution || "pending").trim();
  const registeredBy = String(body?.registeredBy || "").trim().toUpperCase();
  const authorizedBy = String(body?.authorizedBy || "").trim().toUpperCase();
  const status = resolution === "pending" ? "open" : "resolved";

  if (!TYPE_VALUES.has(type)) {
    throw new Error("Debes seleccionar un tipo de excepcion valido.");
  }

  if (!RESOLUTION_VALUES.has(resolution)) {
    throw new Error("Debes seleccionar una resolucion valida.");
  }

  if (!registeredBy) {
    throw new Error("Debes indicar quien registro la excepcion.");
  }

  if (endDateData && endDateData.date.getTime() < date.getTime()) {
    throw new Error("La fecha de fin no puede ser anterior a la fecha inicial.");
  }

  return {
    employee: employee._id,
    employeeName: employee.fullName || "",
    employeeDni: employee.dni || "",
    branchName: employee.branchName || employee.branch || "",
    areaName: employee.areaName || employee.department || "",
    roleName: employee.roleName || "",
    type,
    date,
    dateKey,
    endDate: endDateData?.date || null,
    endDateKey: endDateData?.dateKey || "",
    registeredBy,
    authorizedBy,
    resolution,
    resolutionNotes: String(body?.resolutionNotes || "").trim(),
    notes: String(body?.notes || "").trim(),
    status,
  };
}

export function serializeOperationalException(exception) {
  const type = exception.type || "other";
  const resolution = exception.resolution || "pending";

  return {
    id: exception._id.toString(),
    employeeId: exception.employee?.toString?.() || String(exception.employee || ""),
    employeeName: exception.employeeName || "",
    employeeDni: exception.employeeDni || "",
    branchName: exception.branchName || "",
    areaName: exception.areaName || "",
    roleName: exception.roleName || "",
    type,
    typeLabel: getLabel(EXCEPTION_TYPES, type),
    dateKey: exception.dateKey || "",
    endDateKey: exception.endDateKey || "",
    registeredBy: exception.registeredBy || "",
    authorizedBy: exception.authorizedBy || "",
    resolution,
    resolutionLabel: getLabel(EXCEPTION_RESOLUTIONS, resolution),
    resolutionNotes: exception.resolutionNotes || "",
    notes: exception.notes || "",
    status: exception.status || "open",
    createdAt: exception.createdAt,
    updatedAt: exception.updatedAt,
  };
}
