import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Áreas | Control de Asistencia",
};

export default function SettingsAreasPage() {
  return (
    <DashboardShell
      title="Áreas"
      description="Página base para las áreas funcionales del negocio."
    >
      <ModuleScaffold
        eyebrow="Configuración"
        title="Catálogo de áreas"
        description="Aquí se administrarán áreas como ventas, logística y bodega, y administrativos."
      />
    </DashboardShell>
  );
}
