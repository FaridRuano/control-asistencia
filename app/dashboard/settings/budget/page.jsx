import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Parámetros de presupuesto | Control de Asistencia",
};

export default function SettingsBudgetPage() {
  return (
    <DashboardShell
      title="Parámetros de presupuesto"
      description="Página base para topes y proyecciones de costo."
    >
      <ModuleScaffold
        eyebrow="Configuración"
        title="Variables económicas"
        description="Aquí quedarán los parámetros que alimenten el costo esperado del mes y ayuden al planificador a no salir del presupuesto."
      />
    </DashboardShell>
  );
}
