import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Incidencias | Control de Asistencia",
};

export default function OperationsIncidentsPage() {
  return (
    <DashboardShell
      title="Incidencias"
      description="Página base para registrar novedades reales del mes."
    >
      <ModuleScaffold
        eyebrow="Operación"
        title="Registro de incidencias"
        description="Aquí luego podremos ingresar ausencias, enfermedad, atrasos relevantes, reemplazos y cualquier evento que modifique el cumplimiento esperado."
      />
    </DashboardShell>
  );
}
