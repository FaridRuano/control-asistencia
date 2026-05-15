import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Costo ejecutado | Control de Asistencia",
};

export default function PayrollExecutedCostPage() {
  return (
    <DashboardShell
      title="Costo ejecutado"
      description="Página base para el costo real del período según lo sucedido."
    >
      <ModuleScaffold
        eyebrow="Nómina y costos"
        title="Impacto económico real"
        description="Aquí podremos consolidar horas reales, recargos, descuentos, autorizaciones y diferencias frente al presupuesto planificado."
      />
    </DashboardShell>
  );
}
