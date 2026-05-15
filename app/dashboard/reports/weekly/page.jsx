import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Reporte semanal | Control de Asistencia",
};

export default function ReportsWeeklyPage() {
  return (
    <DashboardShell
      title="Reporte semanal"
      description="Página base para seguimiento operativo por semana."
    >
      <ModuleScaffold
        eyebrow="Reportes"
        title="Seguimiento semanal"
        description="Aquí luego mostraremos comparativos semanales para detectar desviaciones tempranas."
      />
    </DashboardShell>
  );
}
