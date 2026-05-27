import DashboardShell from "@/components/dashboard/DashboardShell";
import SchedulePlanner from "@/components/planning/SchedulePlanner";

export const metadata = {
  title: "Programacion de horarios | Control de Asistencia",
};

export default function PlanningMonthlyPage() {
  return (
    <DashboardShell
      title="Programacion de horarios"
      description="Asigna plantillas por empleado, sucursal y mes; el sistema calcula los dias reales del periodo y sus semanas parciales."
    >
      <SchedulePlanner />
    </DashboardShell>
  );
}
