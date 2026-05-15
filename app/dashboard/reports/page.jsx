import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { planningModulePath } from "@/lib/modules/planning/routes";

export const metadata = {
  title: "Reportes | Control de Asistencia",
};

export default function ReportsPage() {
  return (
    <DashboardShell
      title="Reportes"
      description="Módulo para salidas de análisis, auditoría y seguimiento gerencial."
    >
      <ModuleScaffold
        eyebrow="Reportes"
        title="Centro de salidas del sistema"
        description="Aquí concentraremos los reportes operativos y gerenciales del sistema para análisis por período, empleado, sucursal y estructura organizativa."
        sections={[
          { title: "Mensual", description: "Cierre integral del período.", href: planningModulePath("/reports/monthly") },
          { title: "Semanal", description: "Seguimiento más corto y táctico.", href: planningModulePath("/reports/weekly") },
          { title: "Por empleado", description: "Trazabilidad individual.", href: planningModulePath("/reports/employees") },
          { title: "Por sucursal", description: "Comparativo por sede.", href: planningModulePath("/reports/branches") },
          { title: "Por área y rol", description: "Distribución organizativa.", href: planningModulePath("/reports/organization") },
          { title: "Planificado vs real", description: "Brechas y cumplimiento.", href: planningModulePath("/reports/plan-vs-real") },
        ]}
      />
    </DashboardShell>
  );
}
