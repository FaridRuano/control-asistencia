import DashboardShell from "@/components/dashboard/DashboardShell";
import ExceptionManager from "@/components/planning/ExceptionManager";

export const metadata = {
  title: "Ajustes y excepciones | Control de Asistencia",
};

export default function PlanningExceptionsPage() {
  return (
    <DashboardShell
      title="Ajustes y excepciones"
      description="Centraliza las novedades reales que modifican el plan: ausencias, permisos, cambios, reemplazos y decisiones operativas."
    >
      <ExceptionManager
        eyebrow="Planificacion"
        title="Gestion de cambios operativos"
        description="Registra que ocurrio, quien lo reporto, quien lo autorizo y que decision se tomo para asistencia, cobertura o nomina."
      />
    </DashboardShell>
  );
}
