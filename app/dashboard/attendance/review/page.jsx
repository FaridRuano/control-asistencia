import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { planningModulePath } from "@/lib/modules/planning/routes";

export const metadata = {
  title: "Revisar picadas | Control de Asistencia",
};

export default function AttendanceReviewPage() {
  return (
    <DashboardShell
      title="Revisar picadas"
      description="Página base para validar y depurar la información importada."
    >
      <ModuleScaffold
        eyebrow="Asistencia"
        title="Normalización y revisión"
        description="Este espacio servirá para validar nombres, códigos, agrupación por semana y coherencia del dato antes de compararlo con el horario planificado."
        legacyLinks={[
          {
            href: planningModulePath("/uploads"),
            label: "Flujo actual de revisión",
            description: "La revisión hoy parte desde la pantalla de cargas.",
          },
        ]}
      />
    </DashboardShell>
  );
}
