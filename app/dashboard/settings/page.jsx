import DashboardShell from "@/components/dashboard/DashboardShell";
import ModuleScaffold from "@/components/dashboard/ModuleScaffold";
import { planningModulePath } from "@/lib/modules/planning/routes";

export const metadata = {
  title: "Configuración | Control de Asistencia",
};

export default function SettingsPage() {
  return (
    <DashboardShell
      title="Configuración del módulo"
      description="Módulo para administrar reglas y parámetros propios de planificación y control operativo."
    >
      <ModuleScaffold
        eyebrow="Configuración"
        title="Parámetros propios del módulo"
        description="La idea es evitar que demasiadas reglas queden quemadas en código. Aquí vivirá la parametrización específica del módulo de planificación y control operativo."
        sections={[
          { title: "Horarios base", description: "Plantillas por rol.", href: planningModulePath("/settings/base-schedules") },
          { title: "Feriados", description: "Calendario laboral del mes.", href: planningModulePath("/settings/holidays") },
          { title: "Reglas laborales", description: "Horas, descansos y recargos.", href: planningModulePath("/settings/labor-rules") },
          { title: "Parámetros de presupuesto", description: "Topes y proyecciones.", href: planningModulePath("/settings/budget") },
          { title: "Autorizaciones", description: "Permisos de horas y excepciones.", href: planningModulePath("/settings/authorizations") },
        ]}
        futureNote="La estructura global de empresa, personal y acceso ahora puede vivir en el módulo independiente de Empresa y configuración global."
      />
    </DashboardShell>
  );
}
