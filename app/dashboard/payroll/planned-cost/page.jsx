import DashboardShell from "@/components/dashboard/DashboardShell";
import PayrollPlannedCostView from "@/components/payroll/PayrollPlannedCostView";

export const metadata = {
  title: "Costo planificado | Control de Asistencia",
};

export default async function PayrollPlannedCostPage({ searchParams }) {
  const {
    month = "",
  } = await searchParams;

  return (
    <DashboardShell
      title="Costo planificado"
      description="Revisa el costo esperado del plan mensual por sucursal, area, rol y empleado."
    >
      <PayrollPlannedCostView initialFilters={{ month }} mode="overview" />
    </DashboardShell>
  );
}
