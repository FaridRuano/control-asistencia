import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Feriados | Control de Asistencia",
};

export default function SettingsHolidaysPage() {
  return (
    <DashboardShell
      title="Feriados"
      description="Página base para el calendario laboral."
    >
      <ModuleScaffold
        eyebrow="Configuración"
        title="Calendario de feriados"
        description="Aquí definiremos los feriados que afectarán los días laborables, el cálculo del sueldo y la lógica de horas extraordinarias."
      />
    </DashboardShell>
  );
}
