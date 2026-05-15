import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Reglas laborales | Control de Asistencia",
};

export default function SettingsLaborRulesPage() {
  return (
    <DashboardShell
      title="Reglas laborales"
      description="Página base para parámetros de jornada, descansos y recargos."
    >
      <ModuleScaffold
        eyebrow="Configuración"
        title="Parámetros laborales"
        description="Aquí luego podremos configurar horas semanales, días de descanso, horas suplementarias por día, reglas de feriado y criterios de pago."
      />
    </DashboardShell>
  );
}
