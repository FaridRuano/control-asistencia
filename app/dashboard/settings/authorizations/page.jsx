import DashboardShell from "@/components/dashboard/DashboardShell";
import AuthorizationSettingsManager from "@/components/planning/AuthorizationSettingsManager";

export const metadata = {
  title: "Autorizaciones | Control de Asistencia",
};

export default function SettingsAuthorizationsPage() {
  return (
    <DashboardShell
      title="Autorizaciones"
      description="Reglas globales para determinar que horas y excepciones requieren aprobacion."
    >
      <AuthorizationSettingsManager />
    </DashboardShell>
  );
}
