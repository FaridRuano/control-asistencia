import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { planningModulePath } from "@/lib/modules/planning/routes";

export const metadata = {
  title: "Horas extra y suplementarias | Control de Asistencia",
};

export default function PayrollOvertimePage() {
  return (
    <DashboardShell
      title="Horas extra y suplementarias"
      description="Página base para controlar autorizaciones, límites y cálculo de recargos."
    >
      <ModuleScaffold
        eyebrow="Nómina y costos"
        title="Control de recargos"
        description="Este módulo se enfocará en validar horas suplementarias y extraordinarias, sus autorizaciones y el impacto económico asociado."
        legacyLinks={[
          {
            href: `${planningModulePath("/payroll")}?mode=month`,
            label: "Validación actual",
            description: "El flujo heredado ya permite revisar candidatos de horas adicionales por día.",
          },
        ]}
      />
    </DashboardShell>
  );
}
