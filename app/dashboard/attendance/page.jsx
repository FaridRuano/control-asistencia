import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { planningModulePath } from "@/lib/modules/planning/routes";

export const metadata = {
  title: "Asistencia | Control de Asistencia",
};

export default function AttendancePage() {
  return (
    <DashboardShell
      title="Asistencia"
      description="Módulo orientado a capturar, revisar y comparar las picadas con la planificación."
    >
      <ModuleScaffold
        eyebrow="Asistencia"
        title="Ejecución real del personal"
        description="Aquí agruparemos la carga de picadas, la revisión del dato biométrico y la comparación directa contra el horario esperado."
        sections={[
          {
            title: "Cargar picadas",
            description: "Ingreso del archivo del biométrico o fuente equivalente.",
            href: planningModulePath("/attendance/uploads"),
          },
          {
            title: "Revisar picadas",
            description: "Normalización, control y depuración de los registros.",
            href: planningModulePath("/attendance/review"),
          },
          {
            title: "Comparar con horario",
            description: "Cruce entre ejecución real y horario planificado.",
            href: planningModulePath("/attendance/comparison"),
          },
        ]}
        legacyLinks={[
          {
            href: planningModulePath("/uploads"),
            label: "Cargas actuales",
            description: "Flujo actual para subir y procesar el archivo de asistencia.",
          },
        ]}
      />
    </DashboardShell>
  );
}
