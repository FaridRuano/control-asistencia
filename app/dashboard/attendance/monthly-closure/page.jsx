import MonthlyClosureView from "@/components/attendance/MonthlyClosureView";
import DashboardShell from "@/components/dashboard/DashboardShell";

export const metadata = {
  title: "Cierre de mes | Control de Asistencia",
};

export default function AttendanceMonthlyClosurePage() {
  return (
    <DashboardShell
      title="Cierre de mes"
      description="Guarda una copia fija de las horas del mes para usarla como base de nomina."
    >
      <MonthlyClosureView />
    </DashboardShell>
  );
}
