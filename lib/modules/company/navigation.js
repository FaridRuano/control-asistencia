import { companyModulePath } from "@/lib/modules/company/routes";

export const COMPANY_MODULE_NAVIGATION = [
  {
    title: "Inicio",
    href: companyModulePath("/home"),
    items: [
      {
        href: companyModulePath("/home"),
        label: "Resumen general",
        description: "Vista del módulo global",
      },
    ],
  },
  {
    title: "Empresa",
    href: companyModulePath("/organization"),
    items: [
      {
        href: companyModulePath("/employees"),
        label: "Empleados",
        description: "Gestión de personal y estructura base",
      },
      {
        href: companyModulePath("/branches"),
        label: "Sucursales",
        description: "Sedes y contexto operativo",
      },
      {
        href: companyModulePath("/areas"),
        label: "Áreas",
        description: "Agrupación funcional del negocio",
      },
      {
        href: companyModulePath("/roles"),
        label: "Roles",
        description: "Perfiles y responsabilidades",
      },
    ],
  },
  {
    title: "Acceso",
    href: companyModulePath("/access"),
    items: [
      {
        href: companyModulePath("/users"),
        label: "Usuarios y permisos",
        description: "Acceso al sistema y perfiles internos",
      },
    ],
  },
];
