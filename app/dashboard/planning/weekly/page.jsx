import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { planningModulePath } from "@/lib/modules/planning/routes";

export const metadata = {
  title: "Plan semanal | Control de Asistencia",
};

export default function PlanningWeeklyPage() {
  return (
    <DashboardShell
      title="Plan semanal"
      description="Página base para consolidar la visualización y edición de la semana operativa."
    >
      <ModuleScaffold
        eyebrow="Planificación"
        title="Desglose semanal del plan"
        description="Aquí luego podremos aterrizar el plan mensual a una semana específica, revisar rotaciones, backups y continuidad de horarios por rol."
        legacyLinks={[
          {
            href: planningModulePath("/schedules"),
            label: "Base actual de horarios",
            description: "Configuración semanal manual existente.",
          },
        ]}
      />
    </DashboardShell>
  );
}
