import Area from "@/models/Area";
import Role from "@/models/Role";

export const OPERATIONAL_AREAS = [
  {
    code: "ADMIN",
    name: "ADMINISTRATIVO",
    description: "Contabilidad, cartera, compras, marketing, compras publicas y pagos.",
  },
  {
    code: "GER",
    name: "GERENCIA",
    description: "Gerencia general sin control obligatorio de picadas.",
  },
  {
    code: "ALM",
    name: "ALMACEN",
    description: "Atencion comercial, caja, ventas de almacen y apoyo de choferes.",
  },
  {
    code: "BOD",
    name: "BODEGA",
    description: "Bodega, despacho, transporte, tecnicos y jefatura logistica.",
  },
  {
    code: "CP",
    name: "CARGA PESADA",
    description: "Operacion de carga pesada.",
  },
];

export const OPERATIONAL_ROLES = [
  { code: "CARTER", name: "CARTERA", areaCode: "ADMIN", description: "Gestion de cartera y cobros." },
  { code: "COMPR", name: "COMPRAS", areaCode: "ADMIN", description: "Gestion de compras comerciales." },
  { code: "CONTA", name: "CONTABILIDAD", areaCode: "ADMIN", description: "Contabilidad y control administrativo." },
  { code: "CONTAD", name: "CONTADORA", areaCode: "ADMIN", description: "Responsable contable." },
  { code: "COMPU", name: "COMPRAS PUBLICAS", areaCode: "ADMIN", description: "Procesos de compras publicas." },
  { code: "GERENT", name: "GERENTE", areaCode: "ADMIN", description: "Gerencia administrativa." },
  { code: "JEFADM", name: "JEFATURA ADMINISTRATIVA", areaCode: "ADMIN", description: "Jefatura administrativa." },
  { code: "MARKET", name: "MARKETING", areaCode: "ADMIN", description: "Marketing y comunicacion." },
  { code: "PAGOS", name: "PAGOS", areaCode: "ADMIN", description: "Pagos y tesoreria operativa." },
  { code: "GERGEN", name: "GERENCIA", areaCode: "GER", description: "Gerencia general sin horas suplementarias ni extraordinarias." },
  { code: "CAJALM", name: "CAJERA", areaCode: "ALM", description: "Caja y facturacion de almacen." },
  { code: "CHOALM", name: "CHOFER", areaCode: "ALM", description: "Transporte y entregas de almacen." },
  { code: "JEFALM", name: "JEFATURA ALMACEN", areaCode: "ALM", description: "Jefatura de almacen." },
  { code: "VENDALM", name: "VENDEDOR", areaCode: "ALM", description: "Atencion y venta de almacen." },
  { code: "BODEG", name: "BODEGUERO", areaCode: "BOD", description: "Operacion de bodega y despacho." },
  { code: "CHOFER", name: "CHOFER", areaCode: "BOD", description: "Transporte y entregas de bodega." },
  { code: "JEFLOG", name: "JEFATURA LOGISTICA", areaCode: "BOD", description: "Jefatura de logistica y bodega." },
  { code: "TECBOD", name: "TECNICO", areaCode: "BOD", description: "Tecnico asignado a bodega." },
  { code: "CHOFE2", name: "CHOFER", areaCode: "CP", description: "Chofer de carga pesada." },
];

export const OPERATIONAL_TEMPLATES = [];

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

  return {
    areas: areaResults.length,
    roles: roleResults.length,
    templates: OPERATIONAL_TEMPLATES.length,
  };
}
