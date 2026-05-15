import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Horarios base | Control de Asistencia",
};

export default function SettingsBaseSchedulesPage() {
  return (
    <DashboardShell
      title="Horarios base"
      description="Página base para las plantillas de horarios por rol."
    >
      <ModuleScaffold
        eyebrow="Configuración"
        title="Plantillas de jornada"
        description="Aquí luego administraremos los horarios modelo que alimentarán el planificador mensual y semanal."
      />
    </DashboardShell>
  );
}
