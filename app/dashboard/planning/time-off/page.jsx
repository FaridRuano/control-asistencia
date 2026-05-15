import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Vacaciones y permisos | Control de Asistencia",
};

export default function PlanningTimeOffPage() {
  return (
    <DashboardShell
      title="Vacaciones y permisos"
      description="Página destinada a las ausencias programadas que impactan la planificación."
    >
      <ModuleScaffold
        eyebrow="Planificación"
        title="Ausencias programadas"
        description="Aquí luego registraremos vacaciones, permisos y criterios de pago asociados para que el plan mensual y semanal salgan ajustados desde el inicio."
      />
    </DashboardShell>
  );
}
