import DashboardShell from "@/components/dashboard/DashboardShell";
import BaseSchedulesManager from "@/components/planning/BaseSchedulesManager";

export const metadata = {
  title: "Horarios base | Control de Asistencia",
};

export default function SettingsBaseSchedulesPage() {
  return (
    <DashboardShell
      title="Horarios base"
      description="Plantillas de jornada por area y rol para alimentar la planificacion mensual y semanal."
    >
      <BaseSchedulesManager />
    </DashboardShell>
  );
}
