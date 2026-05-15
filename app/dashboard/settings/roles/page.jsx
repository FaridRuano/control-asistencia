import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Roles | Control de Asistencia",
};

export default function SettingsRolesPage() {
  return (
    <DashboardShell
      title="Roles"
      description="Página base para los roles que participan en la operación."
    >
      <ModuleScaffold
        eyebrow="Configuración"
        title="Catálogo de roles"
        description="Aquí luego podremos administrar roles como cajera, ferretero, jefe, bodeguero, chofer y perfiles administrativos."
      />
    </DashboardShell>
  );
}
