import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { planningModulePath } from "@/lib/modules/planning/routes";

export const metadata = {
  title: "Planificacion | Control de Asistencia",
};

export default function PlanningPage() {
  return (
    <DashboardShell
      title="Planificacion"
      description="Gestiona la programacion de horarios, asignaciones por empleado, excepciones y vacaciones antes de contrastar contra la operacion real."
    >
      <ModuleScaffold
        eyebrow="Planificacion"
        title="Programacion operativa"
        description="El flujo principal parte de las plantillas de horario y las asigna a empleados por sucursal y mes. Luego se revisan semanas parciales, ajustes, vacaciones y excepciones."
        sections={[
          {
            title: "Programacion de horarios",
            description: "Asignacion mensual por empleado usando plantillas base, sucursal, rol y feriados registrados.",
            href: planningModulePath("/planning/monthly"),
          },
          {
            title: "Revision operativa",
            description: "Lectura semanal del plan para validar continuidad, descansos, backups y dias extraordinarios.",
            href: planningModulePath("/planning/weekly"),
          },
          {
            title: "Ajustes y excepciones",
            description: "Cambios por empleado, reacomodos, backups, enfermedad y decisiones operativas.",
            href: planningModulePath("/planning/exceptions"),
          },
          {
            title: "Vacaciones programadas",
            description: "Vacaciones solicitadas con anticipacion antes de generar la planificacion.",
            href: planningModulePath("/planning/time-off"),
          },
        ]}
        legacyLinks={[
          {
            href: planningModulePath("/settings/base-schedules"),
            label: "Plantillas de horarios",
            description: "Configurar horarios base por area y rol.",
          },
        ]}
      />
    </DashboardShell>
  );
}
