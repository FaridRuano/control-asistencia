import DashboardShell from "@/components/dashboard/DashboardShell";
import VacationPlanner from "@/components/planning/VacationPlanner";

export const metadata = {
  title: "Vacaciones programadas | Control de Asistencia",
};

export default function PlanningTimeOffPage() {
  return (
    <DashboardShell
      title="Vacaciones programadas"
      description="Registro de vacaciones solicitadas con anticipacion para descontarlas antes de generar la planificacion mensual."
    >
      <VacationPlanner />
    </DashboardShell>
  );
}
