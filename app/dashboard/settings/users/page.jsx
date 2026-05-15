import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Usuarios y permisos | Control de Asistencia",
};

export default function SettingsUsersPage() {
  return (
    <DashboardShell
      title="Usuarios y permisos"
      description="Página base para la futura capa de acceso al sistema."
    >
      <ModuleScaffold
        eyebrow="Configuración"
        title="Base para autenticación y permisos"
        description="No es la prioridad funcional inmediata, pero ya dejamos el espacio listo para usuarios, roles internos, perfiles de acceso y permisos por módulo."
        futureNote="Mi recomendación es que usuarios y permisos se construyan después de estabilizar la estructura del negocio y los módulos core de planificación, asistencia y costos."
      />
    </DashboardShell>
  );
}
