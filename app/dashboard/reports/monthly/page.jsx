import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Reporte mensual | Control de Asistencia",
};

export default function ReportsMonthlyPage() {
  return (
    <DashboardShell
      title="Reporte mensual"
      description="Página base para el cierre integral del mes."
    >
      <ModuleScaffold
        eyebrow="Reportes"
        title="Cierre mensual"
        description="Aquí saldrá luego el resumen consolidado del mes con planificación, ejecución, costos, novedades y cumplimiento."
      />
    </DashboardShell>
  );
}
