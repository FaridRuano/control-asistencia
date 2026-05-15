import DashboardShell from "@/components/dashboard/DashboardShell";
import RoleManagement from "@/components/company/RoleManagement";
import { COMPANY_MODULE } from "@/lib/modules/company/module";

export const metadata = {
  title: "Roles | Empresa y configuración global",
};

export default function CompanyRolesPage() {
  return (
    <DashboardShell
      moduleConfig={COMPANY_MODULE}
      title="Roles"
      description="Administra el catálogo global de roles y relaciónalos con las áreas definidas por la empresa."
    >
      <RoleManagement />
    </DashboardShell>
  );
}
