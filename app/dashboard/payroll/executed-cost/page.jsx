import DashboardShell from "@/components/dashboard/DashboardShell";
import PayrollExecutedCostView from "@/components/payroll/PayrollExecutedCostView";

export const metadata = {
  title: "Costo ejecutado | Control de Asistencia",
};

export default function PayrollExecutedCostPage() {
  return (
    <DashboardShell
      title="Costo ejecutado"
      description="Costo real calculado desde el cierre mensual de asistencia."
    >
      <PayrollExecutedCostView />
    </DashboardShell>
  );
}
