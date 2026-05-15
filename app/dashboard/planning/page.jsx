import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { planningModulePath } from "@/lib/modules/planning/routes";

export const metadata = {
  title: "Planificación | Control de Asistencia",
};

export default function PlanningPage() {
  return (
    <DashboardShell
      title="Planificación"
      description="Módulo destinado a construir el horario óptimo del mes, bajar el plan a semanas y gestionar cambios antes de contrastarlo con la operación real."
    >
      <ModuleScaffold
        eyebrow="Planificación"
        title="Arquitectura funcional del planificador"
        description="Aquí vivirá la lógica principal del sistema: cálculo de días laborables, cobertura por rol, restricciones por feriados, descansos obligatorios, presupuesto y ajustes operativos."
        sections={[
          {
            title: "Plan mensual",
            description: "Generación del horario base del mes según sucursal, área, rol, presupuesto y reglas laborales.",
            href: planningModulePath("/planning/monthly"),
          },
          {
            title: "Plan semanal",
            description: "Aterriza el plan mensual para seguimiento y pequeños ajustes de continuidad.",
            href: planningModulePath("/planning/weekly"),
          },
          {
            title: "Ajustes y excepciones",
            description: "Cambios por empleado, reacomodos, backups, enfermedad y decisiones operativas.",
            href: planningModulePath("/planning/exceptions"),
          },
          {
            title: "Vacaciones y permisos",
            description: "Ausencias programadas y permisos que alteran la planificación del período.",
            href: planningModulePath("/planning/time-off"),
          },
        ]}
        legacyLinks={[
          {
            href: planningModulePath("/schedules"),
            label: "Horarios semanales actuales",
            description: "Base existente de configuración manual por empleado.",
          },
        ]}
        futureNote="La implementación real del optimizador mensual debe construirse después de definir bien las reglas configurables y las entidades del negocio."
      />
    </DashboardShell>
  );
}
