import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Ajustes y excepciones | Control de Asistencia",
};

export default function PlanningExceptionsPage() {
  return (
    <DashboardShell
      title="Ajustes y excepciones"
      description="Aquí quedará centralizada la edición del plan cuando la realidad obligue a desviarse del horario óptimo."
    >
      <ModuleScaffold
        eyebrow="Planificación"
        title="Gestión de cambios operativos"
        description="El módulo servirá para registrar diferencias como enfermedad, cambios de turno, backups, reemplazos, permisos y ajustes específicos por empleado."
        sections={[
          {
            title: "Tipos de excepciones previstas",
            description: "Casos que luego debemos modelar explícitamente.",
            bullets: [
              "Enfermedad y ausencia inesperada.",
              "Cambio manual de horario.",
              "Cobertura por backup o reemplazo.",
              "Permiso parcial o total.",
              "Vacación que altera la cobertura del área.",
            ],
          },
        ]}
      />
    </DashboardShell>
  );
}
