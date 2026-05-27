import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { planningModulePath } from "@/lib/modules/planning/routes";

export const metadata = {
  title: "Revision operativa | Control de Asistencia",
};

export default function PlanningWeeklyPage() {
  return (
    <DashboardShell
      title="Revision operativa"
      description="Vista para revisar la programacion ya asignada por semanas, especialmente cuando el mes inicia o termina a mitad de semana."
    >
      <ModuleScaffold
        eyebrow="Programacion"
        title="Revision semanal de horarios"
        description="La asignacion principal vive en Programacion de horarios. Esta vista quedara como el tablero de lectura por semana para validar continuidad, backups, descansos y dias extraordinarios."
        sections={[
          {
            title: "Siguiente paso",
            description: "Usar las asignaciones mensuales guardadas para mostrar cada semana real del mes y permitir ajustes puntuales.",
          },
        ]}
        legacyLinks={[
          {
            href: planningModulePath("/planning/monthly"),
            label: "Ir a programacion de horarios",
            description: "Asignar plantillas por empleado, sucursal y mes.",
          },
        ]}
      />
    </DashboardShell>
  );
}
