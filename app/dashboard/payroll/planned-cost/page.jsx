import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Costo planificado | Control de Asistencia",
};

export default function PayrollPlannedCostPage() {
  return (
    <DashboardShell
      title="Costo planificado"
      description="Página base para medir el costo laboral esperado del plan mensual."
    >
      <ModuleScaffold
        eyebrow="Nómina y costos"
        title="Presupuesto del plan"
        description="Aquí luego compararemos cuánto debería costar el mes según la planificación por sucursal, área, rol y empleado."
      />
    </DashboardShell>
  );
}
