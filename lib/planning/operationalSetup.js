import Area from "@/models/Area";
import BaseScheduleTemplate from "@/models/BaseScheduleTemplate";
import Employee from "@/models/Employee";
import LaborRuleConfig from "@/models/LaborRuleConfig";
import OperationalException from "@/models/OperationalException";
import Role from "@/models/Role";
import VacationRequest from "@/models/VacationRequest";

export const OPERATIONAL_AREAS = [
  {
    code: "VENTAS",
    name: "VENTAS",
    description: "Atencion comercial, cajas, ferreteria, acabados y jefatura de piso.",
  },
  {
    code: "LOGBOD",
    name: "LOGISTICA Y BODEGA",
    description: "Bodega, despacho, transporte, choferes y jefatura logistica.",
  },
  {
    code: "ADMIN",
    name: "ADMINISTRATIVO",
    description: "Contabilidad, cartera, compras, marketing, compras publicas y pagos.",
  },
];

export const OPERATIONAL_ROLES = [
  { code: "CAJERA", name: "CAJERA", areaCode: "VENTAS", description: "Caja y facturacion de ventas." },
  { code: "FERRET", name: "FERRETERO", areaCode: "VENTAS", description: "Atencion y venta de ferreteria." },
  { code: "ACABAD", name: "ACABADOS", areaCode: "VENTAS", description: "Atencion y venta de acabados." },
  { code: "JEFVEN", name: "JEFATURA VENTAS", areaCode: "VENTAS", description: "Jefatura de ventas con rotacion semanal." },
  { code: "BACKJV", name: "BACKUP JEFATURA VENTAS", areaCode: "VENTAS", description: "Backup operativo de jefatura de ventas." },
  { code: "BODEG", name: "BODEGUERO", areaCode: "LOGBOD", description: "Operacion de bodega y despacho." },
  { code: "CHOFER", name: "CHOFER", areaCode: "LOGBOD", description: "Transporte y entregas." },
  { code: "JEFLOG", name: "JEFATURA LOGISTICA Y BODEGA", areaCode: "LOGBOD", description: "Jefatura de logistica y bodega." },
  { code: "BACKJL", name: "BACKUP JEFATURA LOGISTICA Y BODEGA", areaCode: "LOGBOD", description: "Backup operativo de jefatura logistica y bodega." },
  { code: "CONTAD", name: "CONTADORA", areaCode: "ADMIN", description: "Contabilidad y control administrativo." },
  { code: "COMPR", name: "COMPRAS", areaCode: "ADMIN", description: "Gestion de compras comerciales." },
  { code: "CARTER", name: "CARTERA", areaCode: "ADMIN", description: "Gestion de cartera y cobros." },
  { code: "MARKET", name: "MARKETING", areaCode: "ADMIN", description: "Marketing y comunicacion." },
  { code: "COMPU", name: "COMPRAS PUBLICAS", areaCode: "ADMIN", description: "Procesos de compras publicas." },
  { code: "PAGOS", name: "PAGOS", areaCode: "ADMIN", description: "Pagos y tesoreria operativa." },
  { code: "JEFADM", name: "JEFATURA ADMINISTRATIVA", areaCode: "ADMIN", description: "Jefatura administrativa." },
  { code: "BACKJA", name: "BACKUP JEFATURA ADMINISTRATIVA", areaCode: "ADMIN", description: "Backup operativo de jefatura administrativa." },
];

function row(dayOfWeek, startTime, endTime, lunchDurationMinutes, authorizedExtraMinutes, dayType = "workday") {
  const isWorkingDay = dayType !== "off_day";

  return {
    dayOfWeek,
    dayType,
    startTime: isWorkingDay ? startTime : "",
    lunchDurationMinutes: isWorkingDay ? lunchDurationMinutes : 0,
    hasLunch: isWorkingDay,
    endTime: isWorkingDay ? endTime : "",
    authorizedExtraMinutes: isWorkingDay ? authorizedExtraMinutes : 0,
    graceMinutes: 10,
  };
}

function weekRows({ startTime, endTime, lunchDurationMinutes, authorizedExtraMinutes }) {
  return [
    row(0, "", "", 0, 0, "off_day"),
    row(1, startTime, endTime, lunchDurationMinutes, authorizedExtraMinutes),
    row(2, startTime, endTime, lunchDurationMinutes, authorizedExtraMinutes),
    row(3, startTime, endTime, lunchDurationMinutes, authorizedExtraMinutes),
    row(4, startTime, endTime, lunchDurationMinutes, authorizedExtraMinutes),
    row(5, startTime, endTime, lunchDurationMinutes, authorizedExtraMinutes),
    row(6, startTime, endTime, lunchDurationMinutes, authorizedExtraMinutes, "weekend_overtime"),
  ];
}

const SALES_ROLES = ["CAJERA", "FERRET", "ACABAD"];
const LOGISTICS_ROLES = ["BODEG", "CHOFER"];
const ADMIN_ROLES = ["CONTAD", "COMPR", "CARTER", "MARKET", "COMPU", "PAGOS"];

export const OPERATIONAL_TEMPLATES = [
  ...SALES_ROLES.flatMap((roleCode) => [
    {
      name: "VENTAS APERTURA 07H00",
      areaCode: "VENTAS",
      roleCode,
      rotationGroup: "VENTAS_SEMANAL",
      weeklyRows: weekRows({ startTime: "07:00", endTime: "17:30", lunchDurationMinutes: 90, authorizedExtraMinutes: 60 }),
      notes: "Turno estimado de apertura. Ventas usa 1h30 de almuerzo e incluye 1 hora suplementaria autorizada.",
    },
    {
      name: "VENTAS INTERMEDIO 08H00",
      areaCode: "VENTAS",
      roleCode,
      rotationGroup: "VENTAS_SEMANAL",
      weeklyRows: weekRows({ startTime: "08:00", endTime: "18:00", lunchDurationMinutes: 90, authorizedExtraMinutes: 60 }),
      notes: "Turno intermedio para rotacion semanal de ventas.",
    },
    {
      name: "VENTAS CIERRE 09H00",
      areaCode: "VENTAS",
      roleCode,
      rotationGroup: "VENTAS_SEMANAL",
      weeklyRows: weekRows({ startTime: "09:00", endTime: "19:00", lunchDurationMinutes: 90, authorizedExtraMinutes: 60 }),
      notes: "Turno de cierre hasta las 19h00.",
    },
  ]),
  ...["JEFVEN", "BACKJV"].flatMap((roleCode) => [
    {
      name: "JEFATURA VENTAS SEMANA A",
      areaCode: "VENTAS",
      roleCode,
      rotationGroup: "JEFATURA_VENTAS",
      weeklyRows: weekRows({ startTime: "07:00", endTime: "18:00", lunchDurationMinutes: 90, authorizedExtraMinutes: 60 }),
      notes: "Jefatura alternada con backup. Controlar limite de extras mensuales.",
    },
    {
      name: "JEFATURA VENTAS SEMANA B",
      areaCode: "VENTAS",
      roleCode,
      rotationGroup: "JEFATURA_VENTAS",
      weeklyRows: weekRows({ startTime: "08:00", endTime: "19:00", lunchDurationMinutes: 90, authorizedExtraMinutes: 60 }),
      notes: "Semana alterna de jefatura y backup.",
    },
  ]),
  ...LOGISTICS_ROLES.flatMap((roleCode) => [
    {
      name: "LOGISTICA Y BODEGA APERTURA 07H00",
      areaCode: "LOGBOD",
      roleCode,
      rotationGroup: "LOGISTICA_BODEGA_SEMANAL",
      weeklyRows: weekRows({ startTime: "07:00", endTime: "17:00", lunchDurationMinutes: 60, authorizedExtraMinutes: 60 }),
      notes: "Logistica y bodega con 1 hora de almuerzo. Controlar maximo 2 dias extraordinarios.",
    },
    {
      name: "LOGISTICA Y BODEGA CIERRE 08H00",
      areaCode: "LOGBOD",
      roleCode,
      rotationGroup: "LOGISTICA_BODEGA_SEMANAL",
      weeklyRows: weekRows({ startTime: "08:00", endTime: "18:00", lunchDurationMinutes: 60, authorizedExtraMinutes: 60 }),
      notes: "Turno alterno de logistica y bodega.",
    },
  ]),
  ...["JEFLOG", "BACKJL"].flatMap((roleCode) => [
    {
      name: "JEFATURA LOGISTICA Y BODEGA SEMANA A",
      areaCode: "LOGBOD",
      roleCode,
      rotationGroup: "JEFATURA_LOGISTICA_BODEGA",
      weeklyRows: weekRows({ startTime: "07:00", endTime: "18:00", lunchDurationMinutes: 60, authorizedExtraMinutes: 60 }),
      notes: "Jefatura alternada con backup.",
    },
    {
      name: "JEFATURA LOGISTICA Y BODEGA SEMANA B",
      areaCode: "LOGBOD",
      roleCode,
      rotationGroup: "JEFATURA_LOGISTICA_BODEGA",
      weeklyRows: weekRows({ startTime: "08:00", endTime: "19:00", lunchDurationMinutes: 60, authorizedExtraMinutes: 60 }),
      notes: "Semana alterna de jefatura y backup.",
    },
  ]),
  ...ADMIN_ROLES.map((roleCode) => ({
    name: "ADMINISTRATIVO BASE 08H00",
    areaCode: "ADMIN",
    roleCode,
    rotationGroup: "ADMIN_BASE",
    weeklyRows: weekRows({ startTime: "08:00", endTime: "18:00", lunchDurationMinutes: 60, authorizedExtraMinutes: 60 }),
    notes: "Administrativo con 1 hora de almuerzo. Presupuesto estimado de 9 horas diarias.",
  })),
  ...["JEFADM", "BACKJA"].flatMap((roleCode) => [
    {
      name: "JEFATURA ADMINISTRATIVA SEMANA A",
      areaCode: "ADMIN",
      roleCode,
      rotationGroup: "JEFATURA_ADMIN",
      weeklyRows: weekRows({ startTime: "07:00", endTime: "18:00", lunchDurationMinutes: 60, authorizedExtraMinutes: 60 }),
      notes: "Jefatura alternada con backup. Controlar extras mensuales.",
    },
    {
      name: "JEFATURA ADMINISTRATIVA SEMANA B",
      areaCode: "ADMIN",
      roleCode,
      rotationGroup: "JEFATURA_ADMIN",
      weeklyRows: weekRows({ startTime: "08:00", endTime: "19:00", lunchDurationMinutes: 60, authorizedExtraMinutes: 60 }),
      notes: "Semana alterna de jefatura y backup.",
    },
  ]),
];

const TEMPLATE_RENAMES = [
  ["BODEGA APERTURA 07H00", "LOGISTICA Y BODEGA APERTURA 07H00", "LOGISTICA_BODEGA_SEMANAL"],
  ["BODEGA CIERRE 08H00", "LOGISTICA Y BODEGA CIERRE 08H00", "LOGISTICA_BODEGA_SEMANAL"],
  ["JEFATURA LOGISTICA SEMANA A", "JEFATURA LOGISTICA Y BODEGA SEMANA A", "JEFATURA_LOGISTICA_BODEGA"],
  ["JEFATURA LOGISTICA SEMANA B", "JEFATURA LOGISTICA Y BODEGA SEMANA B", "JEFATURA_LOGISTICA_BODEGA"],
];

const LEGACY_AREA_MERGES = [
  {
    code: "BODEGA",
    name: "BODEGA",
    targetCode: "LOGBOD",
  },
];

async function mergeLegacyOperationalAreas(areasByCode) {
  await Promise.all(
    LEGACY_AREA_MERGES.map(async (legacyArea) => {
      const targetArea = areasByCode.get(legacyArea.targetCode);

      if (!targetArea) {
        return;
      }

      await Promise.all([
        Role.updateMany(
          { areaCode: legacyArea.code },
          { $set: { areaCode: targetArea.code, areaName: targetArea.name } },
        ),
        Employee.updateMany(
          { areaCode: legacyArea.code },
          { $set: { areaCode: targetArea.code, areaName: targetArea.name, department: targetArea.name } },
        ),
        Employee.collection.updateMany(
          { "roleAssignments.areaCode": legacyArea.code },
          {
            $set: {
              "roleAssignments.$[assignment].areaCode": targetArea.code,
              "roleAssignments.$[assignment].areaName": targetArea.name,
            },
          },
          { arrayFilters: [{ "assignment.areaCode": legacyArea.code }] },
        ),
        BaseScheduleTemplate.deleteMany({ areaCode: legacyArea.code }),
        LaborRuleConfig.collection.updateMany(
          { "areaLunchRules.areaCode": legacyArea.code },
          {
            $set: {
              "areaLunchRules.$[rule].areaCode": targetArea.code,
              "areaLunchRules.$[rule].areaName": targetArea.name,
            },
          },
          { arrayFilters: [{ "rule.areaCode": legacyArea.code }] },
        ),
        OperationalException.updateMany(
          { areaName: legacyArea.name },
          { $set: { areaName: targetArea.name } },
        ),
        VacationRequest.updateMany(
          { areaName: legacyArea.name },
          { $set: { areaName: targetArea.name } },
        ),
      ]);

      await Area.deleteMany({ code: legacyArea.code });
    }),
  );
}

export async function seedOperationalSetup() {
  const areaResults = await Promise.all(
    OPERATIONAL_AREAS.map((area) =>
      Area.findOneAndUpdate(
        { code: area.code },
        { $set: { ...area, isActive: true } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      ),
    ),
  );
  const areasByCode = new Map(areaResults.map((area) => [area.code, area]));
  await mergeLegacyOperationalAreas(areasByCode);

  const roleResults = await Promise.all(
    OPERATIONAL_ROLES.map((role) => {
      const area = areasByCode.get(role.areaCode);

      return Role.findOneAndUpdate(
        { code: role.code },
        { $set: { ...role, areaName: area?.name || role.areaCode, isActive: true } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
    }),
  );
  const rolesByCode = new Map(roleResults.map((role) => [role.code, role]));
  await Promise.all(
    TEMPLATE_RENAMES.map(([oldName, newName, rotationGroup]) =>
      BaseScheduleTemplate.updateMany(
        { areaCode: "LOGBOD", name: oldName },
        { $set: { name: newName, rotationGroup } },
      ),
    ),
  );
  const templateResults = await Promise.all(
    OPERATIONAL_TEMPLATES.map((template) => {
      const area = areasByCode.get(template.areaCode);
      const role = rolesByCode.get(template.roleCode);

      return BaseScheduleTemplate.findOneAndUpdate(
        {
          areaCode: template.areaCode,
          roleCode: template.roleCode,
          name: template.name,
        },
        {
          $set: {
            ...template,
            areaName: area?.name || template.areaCode,
            roleName: role?.name || template.roleCode,
            isActive: true,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
    }),
  );

  return {
    areas: areaResults.length,
    roles: roleResults.length,
    templates: templateResults.length,
  };
}
