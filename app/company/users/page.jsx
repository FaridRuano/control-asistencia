import DashboardShell from "@/components/dashboard/DashboardShell";
import UserManagement from "@/components/company/UserManagement";
import { COMPANY_MODULE } from "@/lib/modules/company/module";

export const metadata = {
  title: "Usuarios | Empresa y configuración global",
};

export default function CompanyUsersPage() {
  return (
    <DashboardShell
      moduleConfig={COMPANY_MODULE}
      title="Usuarios"
      description="Accesos a la plataforma ligados a empleados activos."
    >
      <UserManagement />
    </DashboardShell>
  );
}
