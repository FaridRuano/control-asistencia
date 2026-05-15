import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { COMPANY_MODULE } from "@/lib/modules/company/module";
import { companyModulePath } from "@/lib/modules/company/routes";

export const metadata = {
  title: "Empresa y configuración global | Control de Asistencia",
};

export default function CompanyHomePage() {
  return (
    <DashboardShell
      moduleConfig={COMPANY_MODULE}
      title="Empresa y configuración global"
      description="Módulo transversal para administrar la estructura compartida de la empresa y el acceso a la plataforma."
    >
      <ModuleScaffold
        eyebrow="Módulo global"
        title="Base compartida para toda la plataforma"
        description="Aquí vivirá la información global que podrá ser reutilizada por distintos módulos del sistema."
        sections={[
          {
            title: "Empresa",
            description: "Empleados, sucursales, áreas y roles compartidos.",
            href: companyModulePath("/organization"),
          },
          {
            title: "Acceso",
            description: "Usuarios, perfiles internos y permisos de la plataforma.",
            href: companyModulePath("/access"),
          },
        ]}
      />
    </DashboardShell>
  );
}
