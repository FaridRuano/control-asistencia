import DashboardShell from "@/components/dashboard/DashboardShell";
import PayrollPlannedCostView from "@/components/payroll/PayrollPlannedCostView";

export const metadata = {
  title: "Analisis de costo planificado | Control de Asistencia",
};

export default async function PayrollPlannedCostAnalysisPage({ searchParams }) {
  const {
    month = "",
    branchCode = "",
    areaCode = "",
    roleCode = "",
  } = await searchParams;

  return (
    <DashboardShell
      title="Analisis de costo planificado"
      description="Filtra el presupuesto mensual por sucursal, area, rol y empleado."
    >
      <PayrollPlannedCostView
        initialFilters={{ month, branchCode, areaCode, roleCode }}
        mode="analysis"
      />
    </DashboardShell>
  );
}
