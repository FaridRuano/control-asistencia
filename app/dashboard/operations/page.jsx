import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { planningModulePath } from "@/lib/modules/planning/routes";

export const metadata = {
  title: "Operación | Control de Asistencia",
};

export default function OperationsPage() {
  return (
    <DashboardShell
      title="Operación"
      description="Módulo pensado para monitorear si la ejecución real va alineada con el plan y registrar incidencias del día a día."
    >
      <ModuleScaffold
        eyebrow="Operación"
        title="Seguimiento del plan"
        description="Aquí se observará el comportamiento vivo del mes: cumplimiento semanal, incidentes, faltantes de cobertura y necesidad de corrección rápida."
        sections={[
          {
            title: "Seguimiento semanal",
            description: "Verificación continua del cumplimiento del plan por semana.",
            href: planningModulePath("/operations/weekly-tracking"),
          },
          {
            title: "Incidencias",
            description: "Registro y tratamiento de eventos reales que alteran el plan.",
            href: planningModulePath("/operations/incidents"),
          },
          {
            title: "Cobertura por área y rol",
            description: "Control de si cada área y rol está siendo atendido según la demanda.",
            href: planningModulePath("/operations/coverage"),
          },
        ]}
      />
    </DashboardShell>
  );
}
