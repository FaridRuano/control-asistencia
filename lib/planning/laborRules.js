export const LABOR_RULE_CONFIG_KEY = "default";

export const DEFAULT_LABOR_RULE_CONFIG = {
  key: LABOR_RULE_CONFIG_KEY,
  companyStartTime: "07:00",
  companyEndTime: "19:00",
  dailyBaseHours: 8,
  weeklyBaseHours: 40,
  defaultGraceMinutes: 10,
  maxSupplementaryMinutesPerDay: 60,
  maxSupplementaryMinutesPerWeek: 300,
  maxExtraordinaryDaysPerMonth: 2,
  supplementaryMultiplier: 1.5,
  extraordinaryMultiplier: 2,
  paidVacationAsWorkday: true,
  vacationIncludesSupplementaryHour: false,
  areaLunchRules: [],
  notes: "",
};

function isValidTimeString(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ""));
}

function normalizeNumber(value, fallback, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function normalizeAreaLunchRule(rule) {
  const areaCode = String(rule?.areaCode || "").trim().toUpperCase();
  const areaName = String(rule?.areaName || "").trim().toUpperCase();
  const lunchDurationMinutes = normalizeNumber(rule?.lunchDurationMinutes, 60, {
    min: 0,
    max: 240,
  });

  if (!areaCode && !areaName) {
    return null;
  }

  return {
    areaCode,
    areaName,
    lunchDurationMinutes,
  };
}

export function normalizeLaborRuleConfigPayload(body) {
  const companyStartTime = String(body?.companyStartTime || DEFAULT_LABOR_RULE_CONFIG.companyStartTime).trim();
  const companyEndTime = String(body?.companyEndTime || DEFAULT_LABOR_RULE_CONFIG.companyEndTime).trim();

  if (!isValidTimeString(companyStartTime) || !isValidTimeString(companyEndTime)) {
    throw new Error("El horario de cobertura debe tener formato HH:mm.");
  }

  const areaLunchRules = (Array.isArray(body?.areaLunchRules) ? body.areaLunchRules : [])
    .map(normalizeAreaLunchRule)
    .filter(Boolean);

  return {
    key: LABOR_RULE_CONFIG_KEY,
    companyStartTime,
    companyEndTime,
    dailyBaseHours: normalizeNumber(body?.dailyBaseHours, 8, { min: 1, max: 24 }),
    weeklyBaseHours: normalizeNumber(body?.weeklyBaseHours, 40, { min: 1, max: 168 }),
    defaultGraceMinutes: normalizeNumber(body?.defaultGraceMinutes, 10, { min: 0, max: 180 }),
    maxSupplementaryMinutesPerDay: normalizeNumber(body?.maxSupplementaryMinutesPerDay, 60, {
      min: 0,
      max: 720,
    }),
    maxSupplementaryMinutesPerWeek: normalizeNumber(body?.maxSupplementaryMinutesPerWeek, 300, {
      min: 0,
      max: 2880,
    }),
    maxExtraordinaryDaysPerMonth: normalizeNumber(body?.maxExtraordinaryDaysPerMonth, 2, {
      min: 0,
      max: 31,
    }),
    supplementaryMultiplier: normalizeNumber(body?.supplementaryMultiplier, 1.5, { min: 1, max: 5 }),
    extraordinaryMultiplier: normalizeNumber(body?.extraordinaryMultiplier, 2, { min: 1, max: 5 }),
    paidVacationAsWorkday: body?.paidVacationAsWorkday === undefined
      ? true
      : Boolean(body.paidVacationAsWorkday),
    vacationIncludesSupplementaryHour: Boolean(body?.vacationIncludesSupplementaryHour),
    areaLunchRules,
    notes: String(body?.notes || "").trim(),
  };
}

export function serializeLaborRuleConfig(config) {
  const source = config || DEFAULT_LABOR_RULE_CONFIG;

  return {
    id: source._id?.toString?.() || "",
    key: source.key || LABOR_RULE_CONFIG_KEY,
    companyStartTime: source.companyStartTime || DEFAULT_LABOR_RULE_CONFIG.companyStartTime,
    companyEndTime: source.companyEndTime || DEFAULT_LABOR_RULE_CONFIG.companyEndTime,
    dailyBaseHours: source.dailyBaseHours ?? DEFAULT_LABOR_RULE_CONFIG.dailyBaseHours,
    weeklyBaseHours: source.weeklyBaseHours ?? DEFAULT_LABOR_RULE_CONFIG.weeklyBaseHours,
    defaultGraceMinutes: source.defaultGraceMinutes ?? DEFAULT_LABOR_RULE_CONFIG.defaultGraceMinutes,
    maxSupplementaryMinutesPerDay:
      source.maxSupplementaryMinutesPerDay ?? DEFAULT_LABOR_RULE_CONFIG.maxSupplementaryMinutesPerDay,
    maxSupplementaryMinutesPerWeek:
      source.maxSupplementaryMinutesPerWeek ?? DEFAULT_LABOR_RULE_CONFIG.maxSupplementaryMinutesPerWeek,
    maxExtraordinaryDaysPerMonth:
      source.maxExtraordinaryDaysPerMonth ?? DEFAULT_LABOR_RULE_CONFIG.maxExtraordinaryDaysPerMonth,
    supplementaryMultiplier:
      source.supplementaryMultiplier ?? DEFAULT_LABOR_RULE_CONFIG.supplementaryMultiplier,
    extraordinaryMultiplier:
      source.extraordinaryMultiplier ?? DEFAULT_LABOR_RULE_CONFIG.extraordinaryMultiplier,
    paidVacationAsWorkday:
      source.paidVacationAsWorkday ?? DEFAULT_LABOR_RULE_CONFIG.paidVacationAsWorkday,
    vacationIncludesSupplementaryHour:
      source.vacationIncludesSupplementaryHour ??
      DEFAULT_LABOR_RULE_CONFIG.vacationIncludesSupplementaryHour,
    areaLunchRules: (source.areaLunchRules || []).map((rule) => ({
      areaCode: rule.areaCode || "",
      areaName: rule.areaName || "",
      lunchDurationMinutes: rule.lunchDurationMinutes ?? 60,
    })),
    notes: source.notes || "",
    createdAt: source.createdAt || null,
    updatedAt: source.updatedAt || null,
  };
}
