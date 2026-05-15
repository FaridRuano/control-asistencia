import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Autorizaciones | Control de Asistencia",
};

export default function SettingsAuthorizationsPage() {
  return (
    <DashboardShell
      title="Autorizaciones"
      description="Página base para permisos operativos y aprobaciones."
    >
      <ModuleScaffold
        eyebrow="Configuración"
        title="Autorizaciones de horas y excepciones"
        description="Aquí luego podremos centralizar aprobaciones para horas suplementarias, extraordinarias y otras decisiones excepcionales."
      />
    </DashboardShell>
  );
}
