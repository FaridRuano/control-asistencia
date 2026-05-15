import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";

export const metadata = {
  title: "Resumen por empleado | Control de Asistencia",
};

export default function PayrollByEmployeePage() {
  return (
    <DashboardShell
      title="Resumen por empleado"
      description="Página base para la vista individual consolidada del período."
    >
      <ModuleScaffold
        eyebrow="Nómina y costos"
        title="Ficha económica individual"
        description="Aquí quedará el detalle por empleado de sueldo base, horas planificadas, ejecutadas, extras, atrasos, ausencias y diferencias del mes."
      />
    </DashboardShell>
  );
}
