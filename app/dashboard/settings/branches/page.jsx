import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Sucursales | Control de Asistencia",
};

export default function SettingsBranchesPage() {
  return (
    <DashboardShell
      title="Sucursales"
      description="Página base para la administración de sedes."
    >
      <ModuleScaffold
        eyebrow="Configuración"
        title="Catálogo de sucursales"
        description="Aquí luego podremos administrar las sedes que participan en la planificación y en los reportes."
      />
    </DashboardShell>
  );
}
