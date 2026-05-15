import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { planningModulePath } from "@/lib/modules/planning/routes";

export const metadata = {
  title: "Nómina y costos | Control de Asistencia",
};

export default function PayrollPage() {
  return (
    <DashboardShell
      title="Nómina y costos"
      description="Módulo pensado para cuantificar el impacto económico de la planificación y de la ejecución real."
    >
      <ModuleScaffold
        eyebrow="Nómina y costos"
        title="Control económico del período"
        description="Aquí se consolidará el análisis de costo planificado, costo real, horas extra, suplementarias, descuentos y trazabilidad financiera por empleado, área y sucursal."
        sections={[
          {
            title: "Costo planificado",
            description: "Presupuesto esperado según el plan mensual.",
            href: planningModulePath("/payroll/planned-cost"),
          },
          {
            title: "Costo ejecutado",
            description: "Resultado real del período según lo ocurrido.",
            href: planningModulePath("/payroll/executed-cost"),
          },
          {
            title: "Horas extra y suplementarias",
            description: "Control operativo y económico de recargos.",
            href: planningModulePath("/payroll/overtime"),
          },
          {
            title: "Resumen por empleado",
            description: "Detalle individual de salario estimado y variaciones.",
            href: planningModulePath("/payroll/by-employee"),
          },
        ]}
        legacyLinks={[
          {
            href: planningModulePath("/payroll/estimate"),
            label: "Estimación actual de nómina",
            description: "Vista heredada enfocada en cálculo y detalle por empleado.",
          },
          {
            href: `${planningModulePath("/payroll")}?mode=month`,
            label: "Análisis legado de picadas",
            description: "Pantalla actual para consultar picadas por período.",
          },
        ]}
      />
    </DashboardShell>
  );
}
