import DashboardShell from "@/components/dashboard/DashboardShell";
import PayrollHomeView from "@/components/payroll/PayrollHomeView";
import { formatEcuadorMonthKey } from "@/lib/datetime/ecuador";

export const metadata = {
  title: "Nómina y costos | Control de Asistencia",
};

export default async function PayrollPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;

  return (
    <DashboardShell
      title="Nómina y costos"
      description="Lectura económica del período: plan, ejecución, cierre mensual y detalle por empleado."
    >
      <PayrollHomeView initialMonth={resolvedSearchParams?.month || formatEcuadorMonthKey()} />
    </DashboardShell>
  );
}
