import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Plan mensual | Control de Asistencia",
};

export default function PlanningMonthlyPage() {
  return (
    <DashboardShell
      title="Plan mensual"
      description="Espacio reservado para el generador del horario óptimo del mes."
    >
      <ModuleScaffold
        eyebrow="Planificación"
        title="Generación mensual"
        description="Esta página concentrará el motor que calculará el plan mensual por sucursal, área y rol, considerando feriados, días laborables, descansos obligatorios, presupuesto y reglas de extras."
        sections={[
          {
            title: "Reglas que deberá considerar",
            description: "Resumen de los criterios más relevantes ya identificados.",
            bullets: [
              "Días laborables por mes según feriados.",
              "Dos días de descanso obligatorios por semana.",
              "Cobertura por área, rol y sucursal.",
              "Presupuesto mensual y costo estimado por empleado.",
              "Horas suplementarias y extraordinarias con autorización.",
            ],
          },
        ]}
      />
    </DashboardShell>
  );
}
