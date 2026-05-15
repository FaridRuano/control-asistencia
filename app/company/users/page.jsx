import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { COMPANY_MODULE } from "@/lib/modules/company/module";

export const metadata = {
  title: "Usuarios y permisos | Empresa y configuración global",
};

export default function CompanyUsersPage() {
  return (
    <DashboardShell
      moduleConfig={COMPANY_MODULE}
      title="Usuarios y permisos"
      description="Base compartida para autenticación, perfiles y acceso por módulo."
    >
      <ModuleScaffold
        eyebrow="Acceso"
        title="Control de usuarios de la plataforma"
        description="Esta sección concentrará el acceso al sistema integral, los perfiles internos y los permisos por módulo o funcionalidad."
      />
    </DashboardShell>
  );
}
