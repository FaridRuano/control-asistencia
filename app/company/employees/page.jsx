import DashboardShell from "@/components/dashboard/DashboardShell";
import EmployeeManagement from "@/components/employees/EmployeeManagement";
import { COMPANY_MODULE } from "@/lib/modules/company/module";

export const metadata = {
  title: "Empleados | Empresa y configuración global",
};

export default function CompanyEmployeesPage() {
  return (
    <DashboardShell
      moduleConfig={COMPANY_MODULE}
      title="Empleados"
      description="Administra la base global de empleados, reutilizable por otros módulos de la plataforma."
    >
      <EmployeeManagement />
    </DashboardShell>
  );
}
