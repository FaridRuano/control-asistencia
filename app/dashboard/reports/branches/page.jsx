import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Reporte por sucursal | Control de Asistencia",
};

export default function ReportsBranchesPage() {
  return (
    <DashboardShell
      title="Reporte por sucursal"
      description="Página base para comparativos entre sedes."
    >
      <ModuleScaffold
        eyebrow="Reportes"
        title="Comparativo entre sucursales"
        description="Aquí podremos analizar cobertura, costos, horas trabajadas y cumplimiento por sucursal."
      />
    </DashboardShell>
  );
}
