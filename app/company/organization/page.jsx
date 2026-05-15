import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { COMPANY_MODULE } from "@/lib/modules/company/module";
import { companyModulePath } from "@/lib/modules/company/routes";

export const metadata = {
  title: "Empresa | Empresa y configuración global",
};

export default function CompanyOrganizationPage() {
  return (
    <DashboardShell
      moduleConfig={COMPANY_MODULE}
      title="Empresa"
      description="Portada de la información organizativa compartida de la empresa."
    >
      <ModuleScaffold
        eyebrow="Empresa"
        title="Estructura organizativa global"
        description="Desde aquí puedes entrar a los catálogos base de la empresa que luego podrán ser utilizados por distintos módulos de la plataforma."
        sections={[
          {
            title: "Empleados",
            description: "Registro y mantenimiento del personal.",
            href: companyModulePath("/employees"),
          },
          {
            title: "Sucursales",
            description: "Sedes y unidades operativas.",
            href: companyModulePath("/branches"),
          },
          {
            title: "Áreas",
            description: "Agrupación funcional del negocio.",
            href: companyModulePath("/areas"),
          },
          {
            title: "Roles",
            description: "Perfiles y responsabilidades reutilizables.",
            href: companyModulePath("/roles"),
          },
        ]}
      />
    </DashboardShell>
  );
}
