import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Reporte por área y rol | Control de Asistencia",
};

export default function ReportsOrganizationPage() {
  return (
    <DashboardShell
      title="Reporte por área y rol"
      description="Página base para análisis organizativo."
    >
      <ModuleScaffold
        eyebrow="Reportes"
        title="Vista estructural del negocio"
        description="Aquí luego mediremos demanda, cobertura, costo y cumplimiento por área y por rol."
      />
    </DashboardShell>
  );
}
