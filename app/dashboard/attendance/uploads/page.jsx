import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { planningModulePath } from "@/lib/modules/planning/routes";

export const metadata = {
  title: "Cargar picadas | Control de Asistencia",
};

export default function AttendanceUploadsPage() {
  return (
    <DashboardShell
      title="Cargar picadas"
      description="Página base para la importación de registros de asistencia."
    >
      <ModuleScaffold
        eyebrow="Asistencia"
        title="Ingreso de archivos de biométrico"
        description="Aquí luego dejaremos la experiencia definitiva de importación, validación y almacenamiento de picadas por período."
        legacyLinks={[
          {
            href: planningModulePath("/uploads"),
            label: "Ir a cargas actuales",
            description: "Formulario funcional ya existente para subir reportes.",
          },
        ]}
      />
    </DashboardShell>
  );
}
