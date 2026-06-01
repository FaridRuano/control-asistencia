import mongoose from "mongoose";

import Area from "../models/Area.js";
import BaseScheduleTemplate from "../models/BaseScheduleTemplate.js";
import LaborRuleConfig from "../models/LaborRuleConfig.js";
import Role from "../models/Role.js";

const AREA_LUNCH_RULES = [
  { areaCode: "ADMIN", areaName: "ADMINISTRATIVO", lunchDurationMinutes: 60 },
  { areaCode: "GER", areaName: "GERENCIA", lunchDurationMinutes: 60 },
  { areaCode: "ALM", areaName: "ALMACEN", lunchDurationMinutes: 90 },
  { areaCode: "BOD", areaName: "BODEGA", lunchDurationMinutes: 90 },
  { areaCode: "CP", areaName: "CARGA PESADA", lunchDurationMinutes: 60 },
];

const ROLE_LUNCH_RULES = new Map([
  ["BOD|CHOFER", 60],
  ["BOD|TECBOD", 60],
  ["CP|CHOFE2", 60],
]);

const ROLE_LUNCH_RULE_LIST = [
  { areaCode: "BOD", areaName: "BODEGA", roleCode: "CHOFER", roleName: "CHOFER", lunchDurationMinutes: 60 },
  { areaCode: "BOD", areaName: "BODEGA", roleCode: "TECBOD", roleName: "TECNICO", lunchDurationMinutes: 60 },
  { areaCode: "CP", areaName: "CARGA PESADA", roleCode: "CHOFE2", roleName: "CHOFER", lunchDurationMinutes: 60 },
];

const PAYROLL_NEUTRAL_ROLE_RULE_LIST = [
  {
    areaCode: "ADMIN",
    areaName: "ADMINISTRATIVO",
    roleCode: "JEFADM",
    roleName: "JEFATURA",
    label: "Ajustado al plan por jefatura",
    scheduleAffectsSalary: false,
    appliesSupplementaryHours: false,
    appliesExtraordinaryHours: false,
  },
  {
    areaCode: "GER",
    areaName: "GERENCIA",
    roleCode: "GERGEN",
    roleName: "GERENCIA",
    label: "Ajustado al plan por gerencia",
    scheduleAffectsSalary: false,
    appliesSupplementaryHours: false,
    appliesExtraordinaryHours: false,
  },
  {
    areaCode: "CP",
    areaName: "CARGA PESADA",
    roleCode: "CHOFE2",
    roleName: "CHOFER",
    label: "Ajustado al plan por viajes",
    scheduleAffectsSalary: false,
    appliesSupplementaryHours: true,
    appliesExtraordinaryHours: true,
  },
];

const ROLE_NOTES = new Map([
  ["BOD|BODEG", "BODEGA/BODEGUERO usa 90 minutos de almuerzo."],
  ["BOD|CHOFER", "BODEGA/CHOFER usa 60 minutos de almuerzo."],
  ["BOD|TECBOD", "BODEGA/TECNICO usa 60 minutos de almuerzo."],
  ["CP|CHOFE2", "CARGA PESADA usa 60 minutos de almuerzo."],
]);

const ADMIN_REFERENCE_ROLE_CODES = new Set(["JEFADM"]);

function row(dayOfWeek, dayType, startTime = "", endTime = "", lunchDurationMinutes = 0, authorizedExtraMinutes = 0) {
  const isWorkingDay = dayType === "workday" || dayType === "weekend_overtime";

  return {
    dayOfWeek,
    dayType,
    startTime: isWorkingDay ? startTime : "",
    lunchDurationMinutes: isWorkingDay ? lunchDurationMinutes : 0,
    hasLunch: isWorkingDay && lunchDurationMinutes > 0,
    endTime: isWorkingDay ? endTime : "",
    authorizedExtraMinutes: isWorkingDay ? authorizedExtraMinutes : 0,
    graceMinutes: 10,
  };
}

function weekdayRows({ startTime, endTime, lunchDurationMinutes, authorizedExtraMinutes = 60 }) {
  return [1, 2, 3, 4, 5].map((dayOfWeek) =>
    row(dayOfWeek, "workday", startTime, endTime, lunchDurationMinutes, authorizedExtraMinutes),
  );
}

function weeklyRows({ startTime, endTime, lunchDurationMinutes, saturday = false, sunday = false }) {
  return [
    ...weekdayRows({ startTime, endTime, lunchDurationMinutes }),
    saturday ? row(6, "weekend_overtime", "08:00", "14:00", 0, 360) : row(6, "off_day"),
    sunday ? row(0, "weekend_overtime", "08:00", "14:00", 0, 360) : row(0, "off_day"),
  ];
}

function baseRows({ startTime, endTime, lunchDurationMinutes, authorizedExtraMinutes = 60 }) {
  return [
    ...weekdayRows({ startTime, endTime, lunchDurationMinutes, authorizedExtraMinutes }),
    row(6, "off_day"),
    row(0, "off_day"),
  ];
}

function template({ name, area, role, rotationGroup, rows, notes }) {
  return {
    name,
    areaCode: area.code,
    areaName: area.name,
    roleCode: role.code,
    roleName: role.name,
    rotationGroup,
    weeklyRows: rows,
    notes,
    isActive: true,
  };
}

function buildTemplatesForRole(area, role) {
  const key = `${area.code}|${role.code}`;
  const lunchDurationMinutes = ROLE_LUNCH_RULES.get(key)
    ?? AREA_LUNCH_RULES.find((rule) => rule.areaCode === area.code)?.lunchDurationMinutes
    ?? 60;
  const note = [
    "Lunes a viernes: 8h normales + 1h suplementaria autorizada.",
    ROLE_NOTES.get(key),
  ].filter(Boolean).join(" ");

  if (area.code === "ADMIN") {
    if (ADMIN_REFERENCE_ROLE_CODES.has(role.code)) {
      return [
        template({
          name: `ADMINISTRATIVO ${role.name} REFERENCIAL 08H00`,
          area,
          role,
          rotationGroup: "ADMIN_BASE",
          rows: baseRows({ startTime: "08:00", endTime: "18:00", lunchDurationMinutes, authorizedExtraMinutes: 0 }),
          notes: "Horario referencial de lunes a viernes. No requiere picadas y no genera horas suplementarias ni extraordinarias.",
        }),
      ];
    }

    return [
      template({
        name: `ADMINISTRATIVO ${role.name} BASE 08H00`,
        area,
        role,
        rotationGroup: "ADMIN_BASE",
        rows: baseRows({ startTime: "08:00", endTime: "18:00", lunchDurationMinutes }),
        notes: `${note} Sabado y domingo quedan como descanso opcional; si hay picadas, se calculan como extraordinarias sin almuerzo planificado.`,
      }),
    ];
  }

  if (area.code === "GER") {
    return [
      template({
        name: "GERENCIA BASE REFERENCIAL 08H00",
        area,
        role,
        rotationGroup: "GER_BASE",
        rows: baseRows({ startTime: "08:00", endTime: "17:00", lunchDurationMinutes, authorizedExtraMinutes: 0 }),
        notes: "Horario referencial de lunes a viernes. No requiere picadas y no genera horas suplementarias ni extraordinarias.",
      }),
    ];
  }

  if (area.code === "CP") {
    return [
      template({
        name: "CARGA PESADA CHOFER BASE 08H00",
        area,
        role,
        rotationGroup: "CP_BASE",
        rows: baseRows({ startTime: "08:00", endTime: "17:00", lunchDurationMinutes, authorizedExtraMinutes: 0 }),
        notes: "Lunes a viernes: 8h normales sin suplementaria planificada. CARGA PESADA usa 60 minutos de almuerzo. Sabado y domingo quedan como descanso opcional; si hay viajes con picadas, se revisan como extraordinarias sin crear variantes de horario.",
      }),
    ];
  }

  if (area.code === "ALM" && role.code !== "JEFALM") {
    return [];
  }

  if (area.code === "ALM") {
    return [
      template({
        name: `ALMACEN ${role.name} BASE SEMANA A 07H00`,
        area,
        role,
        rotationGroup: `ALM_${role.code}_BASE`,
        rows: baseRows({ startTime: "07:00", endTime: "18:00", lunchDurationMinutes }),
        notes: `${note} Fin de semana libre.`,
      }),
      template({
        name: `ALMACEN ${role.name} BASE SEMANA B 08H00`,
        area,
        role,
        rotationGroup: `ALM_${role.code}_BASE`,
        rows: baseRows({ startTime: "08:00", endTime: "19:00", lunchDurationMinutes }),
        notes: `${note} Alternativa de entrada con fin de semana libre.`,
      }),
      template({
        name: `ALMACEN ${role.name} SABADO SEMANA A 07H00`,
        area,
        role,
        rotationGroup: `ALM_${role.code}_SABADO`,
        rows: weeklyRows({ startTime: "07:00", endTime: "18:00", lunchDurationMinutes, saturday: true }),
        notes: `${note} Semana A con sabado extraordinario.`,
      }),
      template({
        name: `ALMACEN ${role.name} SABADO SEMANA B 08H00`,
        area,
        role,
        rotationGroup: `ALM_${role.code}_SABADO`,
        rows: weeklyRows({ startTime: "08:00", endTime: "19:00", lunchDurationMinutes, saturday: true }),
        notes: `${note} Semana B con sabado extraordinario.`,
      }),
      template({
        name: `ALMACEN ${role.name} DOMINGO SEMANA A 07H00`,
        area,
        role,
        rotationGroup: `ALM_${role.code}_DOMINGO`,
        rows: weeklyRows({ startTime: "07:00", endTime: "18:00", lunchDurationMinutes, sunday: true }),
        notes: `${note} Semana A con domingo extraordinario y sabado libre.`,
      }),
      template({
        name: `ALMACEN ${role.name} DOMINGO SEMANA B 08H00`,
        area,
        role,
        rotationGroup: `ALM_${role.code}_DOMINGO`,
        rows: weeklyRows({ startTime: "08:00", endTime: "19:00", lunchDurationMinutes, sunday: true }),
        notes: `${note} Semana B con domingo extraordinario y sabado libre.`,
      }),
      template({
        name: `ALMACEN ${role.name} SABADO DOMINGO SEMANA A 07H00`,
        area,
        role,
        rotationGroup: `ALM_${role.code}_FIN_SEMANA_COMPLETO`,
        rows: weeklyRows({ startTime: "07:00", endTime: "18:00", lunchDurationMinutes, saturday: true, sunday: true }),
        notes: `${note} Caso excepcional con sabado y domingo extraordinarios.`,
      }),
      template({
        name: `ALMACEN ${role.name} SABADO DOMINGO SEMANA B 08H00`,
        area,
        role,
        rotationGroup: `ALM_${role.code}_FIN_SEMANA_COMPLETO`,
        rows: weeklyRows({ startTime: "08:00", endTime: "19:00", lunchDurationMinutes, saturday: true, sunday: true }),
        notes: `${note} Caso excepcional alterno con sabado y domingo extraordinarios.`,
      }),
    ];
  }

  if (area.code === "BOD" && role.code === "BODEG") {
    return [
      template({
        name: "BODEGA BODEGUERO BASE SEMANA A 07H00",
        area,
        role,
        rotationGroup: "BOD_BODEG_BASE",
        rows: baseRows({ startTime: "07:00", endTime: "18:00", lunchDurationMinutes }),
        notes: `${note} Fin de semana libre.`,
      }),
      template({
        name: "BODEGA BODEGUERO BASE SEMANA B 08H00",
        area,
        role,
        rotationGroup: "BOD_BODEG_BASE",
        rows: baseRows({ startTime: "08:00", endTime: "19:00", lunchDurationMinutes }),
        notes: `${note} Alternativa de entrada con fin de semana libre.`,
      }),
      template({
        name: "BODEGA BODEGUERO SABADO SEMANA A 07H00",
        area,
        role,
        rotationGroup: "BOD_BODEG_SABADO",
        rows: weeklyRows({ startTime: "07:00", endTime: "18:00", lunchDurationMinutes, saturday: true }),
        notes: `${note} Semana A con sabado extraordinario.`,
      }),
      template({
        name: "BODEGA BODEGUERO SABADO SEMANA B 08H00",
        area,
        role,
        rotationGroup: "BOD_BODEG_SABADO",
        rows: weeklyRows({ startTime: "08:00", endTime: "19:00", lunchDurationMinutes, saturday: true }),
        notes: `${note} Semana B con sabado extraordinario.`,
      }),
      template({
        name: "BODEGA BODEGUERO DOMINGO SEMANA A 07H00",
        area,
        role,
        rotationGroup: "BOD_BODEG_DOMINGO",
        rows: weeklyRows({ startTime: "07:00", endTime: "18:00", lunchDurationMinutes, sunday: true }),
        notes: `${note} Semana A con domingo extraordinario y sabado libre.`,
      }),
      template({
        name: "BODEGA BODEGUERO DOMINGO SEMANA B 08H00",
        area,
        role,
        rotationGroup: "BOD_BODEG_DOMINGO",
        rows: weeklyRows({ startTime: "08:00", endTime: "19:00", lunchDurationMinutes, sunday: true }),
        notes: `${note} Semana B con domingo extraordinario y sabado libre.`,
      }),
      template({
        name: "BODEGA BODEGUERO SABADO DOMINGO SEMANA A 07H00",
        area,
        role,
        rotationGroup: "BOD_BODEG_FIN_SEMANA_COMPLETO",
        rows: weeklyRows({ startTime: "07:00", endTime: "18:00", lunchDurationMinutes, saturday: true, sunday: true }),
        notes: `${note} Caso excepcional con sabado y domingo extraordinarios.`,
      }),
      template({
        name: "BODEGA BODEGUERO SABADO DOMINGO SEMANA B 08H00",
        area,
        role,
        rotationGroup: "BOD_BODEG_FIN_SEMANA_COMPLETO",
        rows: weeklyRows({ startTime: "08:00", endTime: "19:00", lunchDurationMinutes, saturday: true, sunday: true }),
        notes: `${note} Caso excepcional alterno con sabado y domingo extraordinarios.`,
      }),
    ];
  }

  if (area.code === "BOD") {
    return [
      template({
        name: `BODEGA ${role.name} BASE SEMANA A 07H00`,
        area,
        role,
        rotationGroup: `BOD_${role.code}_BASE`,
        rows: baseRows({ startTime: "07:00", endTime: "17:00", lunchDurationMinutes }),
        notes: `${note} Fin de semana libre; se asigna solo si la operacion lo requiere.`,
      }),
      template({
        name: `BODEGA ${role.name} BASE SEMANA B 08H00`,
        area,
        role,
        rotationGroup: `BOD_${role.code}_BASE`,
        rows: baseRows({ startTime: "08:00", endTime: "18:00", lunchDurationMinutes }),
        notes: `${note} Alternativa de entrada para escalonar cobertura.`,
      }),
      template({
        name: `BODEGA ${role.name} SABADO SEMANA A 07H00`,
        area,
        role,
        rotationGroup: `BOD_${role.code}_SABADO`,
        rows: weeklyRows({ startTime: "07:00", endTime: "17:00", lunchDurationMinutes, saturday: true }),
        notes: `${note} Semana A con sabado extraordinario.`,
      }),
      template({
        name: `BODEGA ${role.name} SABADO SEMANA B 08H00`,
        area,
        role,
        rotationGroup: `BOD_${role.code}_SABADO`,
        rows: weeklyRows({ startTime: "08:00", endTime: "18:00", lunchDurationMinutes, saturday: true }),
        notes: `${note} Semana B con sabado extraordinario.`,
      }),
      template({
        name: `BODEGA ${role.name} DOMINGO SEMANA A 07H00`,
        area,
        role,
        rotationGroup: `BOD_${role.code}_DOMINGO`,
        rows: weeklyRows({ startTime: "07:00", endTime: "17:00", lunchDurationMinutes, sunday: true }),
        notes: `${note} Semana A con domingo extraordinario y sabado libre.`,
      }),
      template({
        name: `BODEGA ${role.name} DOMINGO SEMANA B 08H00`,
        area,
        role,
        rotationGroup: `BOD_${role.code}_DOMINGO`,
        rows: weeklyRows({ startTime: "08:00", endTime: "18:00", lunchDurationMinutes, sunday: true }),
        notes: `${note} Semana B con domingo extraordinario y sabado libre.`,
      }),
      template({
        name: `BODEGA ${role.name} SABADO DOMINGO SEMANA A 07H00`,
        area,
        role,
        rotationGroup: `BOD_${role.code}_FIN_SEMANA_COMPLETO`,
        rows: weeklyRows({ startTime: "07:00", endTime: "17:00", lunchDurationMinutes, saturday: true, sunday: true }),
        notes: `${note} Caso excepcional con sabado y domingo extraordinarios.`,
      }),
      template({
        name: `BODEGA ${role.name} SABADO DOMINGO SEMANA B 08H00`,
        area,
        role,
        rotationGroup: `BOD_${role.code}_FIN_SEMANA_COMPLETO`,
        rows: weeklyRows({ startTime: "08:00", endTime: "18:00", lunchDurationMinutes, saturday: true, sunday: true }),
        notes: `${note} Caso excepcional alterno con sabado y domingo extraordinarios.`,
      }),
    ];
  }

  return [];
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI no esta definido.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  await LaborRuleConfig.findOneAndUpdate(
    { key: "default" },
    {
      $set: {
        key: "default",
        companyStartTime: "07:00",
        companyEndTime: "19:00",
        dailyBaseHours: 8,
        weeklyBaseHours: 40,
        defaultGraceMinutes: 10,
        maxSupplementaryMinutesPerDay: 60,
        maxSupplementaryMinutesPerWeek: 300,
        maxExtraordinaryDaysPerMonth: 5,
        supplementaryMultiplier: 1.5,
        extraordinaryMultiplier: 2,
        paidVacationAsWorkday: true,
        vacationIncludesSupplementaryHour: false,
        areaLunchRules: AREA_LUNCH_RULES,
        roleLunchRules: ROLE_LUNCH_RULE_LIST,
        payrollNeutralRoleRules: PAYROLL_NEUTRAL_ROLE_RULE_LIST,
        notes: "Defaults operativos: 8h normales + 1h suplementaria autorizada de lunes a viernes. Sabados, domingos y feriados trabajados se tratan como extraordinarios. BODEGA/CHOFER y BODEGA/TECNICO usan 60 min de almuerzo aunque el default del area BODEGA sea 90 min.",
      },
    },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

  const [areas, roles] = await Promise.all([
    Area.find({ code: { $in: ["ADMIN", "GER", "ALM", "BOD", "CP"] } }).lean(),
    Role.find({ areaCode: { $in: ["ADMIN", "GER", "ALM", "BOD", "CP"] } }).lean(),
  ]);
  const areasByCode = new Map(areas.map((area) => [area.code, area]));
  const rolesByArea = roles.reduce((map, role) => {
    if (!map.has(role.areaCode)) {
      map.set(role.areaCode, []);
    }

    map.get(role.areaCode).push(role);
    return map;
  }, new Map());
  const templates = [];

  for (const areaCode of ["ADMIN", "GER", "ALM", "BOD", "CP"]) {
    const area = areasByCode.get(areaCode);

    if (!area) {
      continue;
    }

    for (const role of rolesByArea.get(areaCode) || []) {
      templates.push(...buildTemplatesForRole(area, role));
    }
  }

  const keepKeys = new Set(templates.map((item) => `${item.areaCode}|${item.roleCode}|${item.name}`));

  await BaseScheduleTemplate.updateMany(
    {},
    { $set: { isActive: false } },
  );

  for (const item of templates) {
    await BaseScheduleTemplate.findOneAndUpdate(
      { areaCode: item.areaCode, roleCode: item.roleCode, name: item.name },
      { $set: item },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  const staleTemplates = await BaseScheduleTemplate.find({
    areaCode: { $in: ["ADMIN", "GER", "ALM", "BOD", "CP"] },
    isActive: false,
  }).lean();

  console.log(JSON.stringify({
    rules: "updated",
    templatesUpserted: templates.length,
    activeTemplateKeys: keepKeys.size,
    inactiveTemplates: staleTemplates.length,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
