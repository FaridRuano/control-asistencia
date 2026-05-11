import DashboardShell from "@/components/dashboard/DashboardShell";
import EmployeeManagement from "@/components/employees/EmployeeManagement";

export const metadata = {
  title: "Empleados | Control de Asistencia",
};

export default function DashboardEmployeesPage() {
  return (
    <DashboardShell
      title="Gestión de empleados"
      description="Registra, revisa, edita y elimina empleados. El nombre completo será la base para relacionarlos luego con el archivo del biométrico."
    >
      <EmployeeManagement />
    </DashboardShell>
  );
}
