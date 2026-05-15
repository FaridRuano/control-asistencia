import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { planningModulePath } from "@/lib/modules/planning/routes";

export const metadata = {
  title: "Comparar con horario | Control de Asistencia",
};

export default function AttendanceComparisonPage() {
  return (
    <DashboardShell
      title="Comparar con horario"
      description="Página base para el cruce entre lo planificado y lo que realmente ocurrió."
    >
      <ModuleScaffold
        eyebrow="Asistencia"
        title="Planificado vs ejecutado"
        description="Aquí quedará el comparador principal del sistema para revisar horas normales, extras, suplementarias, atrasos, ausencias y diferencias por día o semana."
        legacyLinks={[
          {
            href: planningModulePath("/payroll"),
            label: "Comparación actual",
            description: "El análisis actual de picadas y horario vive en el módulo legado de nómina.",
          },
        ]}
      />
    </DashboardShell>
  );
}
