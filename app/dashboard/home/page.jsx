import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Inicio | Control de Asistencia",
};

export default function DashboardHomePage() {
  return (
    <DashboardShell
      title="Resumen general"
      description="Punto de entrada del sistema para consolidar planificación, operación, asistencia, costos y alertas del período."
    >
      <ModuleScaffold
        eyebrow="Inicio"
        title="Panel principal del sistema"
        description="Esta página será el dashboard ejecutivo. Aquí luego podremos mostrar alertas del mes, cumplimiento semanal, diferencias entre planificado y real, y el impacto económico global por sucursal y área."
        highlights={[
          { label: "Estado", value: "Estructura creada", help: "La navegación base del sistema ya quedó armada." },
          { label: "Siguiente paso", value: "Definir widgets", help: "Indicadores, alertas y accesos rápidos." },
          { label: "Enfoque", value: "RRHH operativo", help: "Planificación, ejecución y análisis." },
        ]}
      />
    </DashboardShell>
  );
}
