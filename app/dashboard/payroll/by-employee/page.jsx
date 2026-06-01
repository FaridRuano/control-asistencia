import DashboardShell from "@/components/dashboard/DashboardShell";
import EmployeeMonthlySummaryView from "@/components/payroll/EmployeeMonthlySummaryView";
import { formatEcuadorMonthKey } from "@/lib/datetime/ecuador";

export const metadata = {
  title: "Resumen por empleado | Control de Asistencia",
};

export default async function PayrollByEmployeePage({ searchParams }) {
  const resolvedSearchParams = await searchParams;

  return (
    <DashboardShell
      title="Resumen por empleado"
      description="Consulta mensual individual con salario, horas planificadas, horas registradas, autorizaciones, novedades y valores por día."
    >
      <EmployeeMonthlySummaryView
        initialEmployeeId={resolvedSearchParams?.employeeId || ""}
        initialMonth={resolvedSearchParams?.month || formatEcuadorMonthKey()}
      />
    </DashboardShell>
  );
}
