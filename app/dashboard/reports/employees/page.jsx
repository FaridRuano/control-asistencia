import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Reporte por empleado | Control de Asistencia",
};

export default function ReportsEmployeesPage() {
  return (
    <DashboardShell
      title="Reporte por empleado"
      description="Página base para análisis individual."
    >
      <ModuleScaffold
        eyebrow="Reportes"
        title="Vista individual"
        description="Este reporte servirá para auditar el desempeño y las diferencias de cada empleado a lo largo del período."
      />
    </DashboardShell>
  );
}
