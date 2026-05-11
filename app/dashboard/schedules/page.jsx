import DashboardShell from "@/components/dashboard/DashboardShell";
import WeeklyScheduleManager from "@/components/schedules/WeeklyScheduleManager";

export const metadata = {
  title: "Horarios | Control de Asistencia",
};

export default function DashboardSchedulesPage() {
  return (
    <DashboardShell
      title="Horarios semanales"
      description="Configura empleado por empleado la semana de lunes a domingo, incluyendo jornadas normales, vacaciones, feriados y fines de semana extraordinarios."
    >
      <WeeklyScheduleManager />
    </DashboardShell>
  );
}
