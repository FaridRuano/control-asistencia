import DashboardShell from "@/components/dashboard/DashboardShell";
import PayrollPunchesView from "@/components/payroll/PayrollPunchesView";

export const metadata = {
  title: "Nómina | Control de Asistencia",
};

export default function PayrollPage() {
  return (
    <DashboardShell
      title="Nómina"
      description="Consulta las picadas individuales ya cargadas al sistema por empleado y por período, para empezar a preparar la revisión de nómina."
    >
      <PayrollPunchesView />
    </DashboardShell>
  );
}
