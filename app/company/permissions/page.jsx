import UserTypeManagement from "@/components/company/UserTypeManagement";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { COMPANY_MODULE } from "@/lib/modules/company/module";

export const metadata = {
  title: "Roles de acceso | Empresa y configuración global",
};

export default function CompanyPermissionsPage() {
  return (
    <DashboardShell
      moduleConfig={COMPANY_MODULE}
      title="Roles de acceso"
      description="Catálogo simple de roles que alimentan el acceso de usuarios a la plataforma."
    >
      <UserTypeManagement />
    </DashboardShell>
  );
}
