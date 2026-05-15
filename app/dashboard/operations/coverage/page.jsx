import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Cobertura por área y rol | Control de Asistencia",
};

export default function OperationsCoveragePage() {
  return (
    <DashboardShell
      title="Cobertura por área y rol"
      description="Página base para contrastar demanda operativa con personal asignado."
    >
      <ModuleScaffold
        eyebrow="Operación"
        title="Matriz de cobertura"
        description="Este módulo servirá para revisar si cada área, rol y sucursal cuenta con la cantidad de personas requerida según el plan y la realidad del período."
      />
    </DashboardShell>
  );
}
