import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { COMPANY_MODULE } from "@/lib/modules/company/module";
import { companyModulePath } from "@/lib/modules/company/routes";

export const metadata = {
  title: "Acceso | Empresa y configuración global",
};

export default function CompanyAccessPage() {
  return (
    <DashboardShell
      moduleConfig={COMPANY_MODULE}
      title="Acceso"
      description="Portada de la administración de usuarios, perfiles y permisos de la plataforma."
    >
      <ModuleScaffold
        eyebrow="Acceso"
        title="Control de usuarios y permisos"
        description="Esta sección agrupa las opciones relacionadas con el acceso al sistema integral, los perfiles internos y los permisos por módulo."
        sections={[
          {
            title: "Usuarios y permisos",
            description: "Administración del acceso a la plataforma.",
            href: companyModulePath("/users"),
          },
        ]}
      />
    </DashboardShell>
  );
}
