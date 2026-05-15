import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Planificado vs real | Control de Asistencia",
};

export default function ReportsPlanVsRealPage() {
  return (
    <DashboardShell
      title="Planificado vs real"
      description="Página base para el comparativo final entre lo esperado y lo ocurrido."
    >
      <ModuleScaffold
        eyebrow="Reportes"
        title="Brecha entre plan y ejecución"
        description="Este reporte será uno de los cierres más importantes del sistema, porque permitirá validar cuánto se cumplió, dónde hubo desviaciones y qué impacto generaron."
      />
    </DashboardShell>
  );
}
