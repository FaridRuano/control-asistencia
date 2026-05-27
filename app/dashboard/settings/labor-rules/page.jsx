import DashboardShell from "@/components/dashboard/DashboardShell";
import LaborRulesManager from "@/components/planning/LaborRulesManager";

export const metadata = {
  title: "Reglas laborales | Control de Asistencia",
};

export default function SettingsLaborRulesPage() {
  return (
    <DashboardShell
      title="Reglas laborales"
      description="Parametros de jornada, descansos, recargos y feriados para el modulo operativo."
    >
      <LaborRulesManager />
    </DashboardShell>
  );
}
