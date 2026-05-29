import DashboardShell from "@/components/dashboard/DashboardShell";
import AttendanceComparisonView from "@/components/attendance/AttendanceComparisonView";

export const metadata = {
  title: "Comparar con horario | Control de Asistencia",
};

export default function AttendanceComparisonPage() {
  return (
    <DashboardShell
      title="Comparar con horario"
      description="Cruza el horario mensual asignado con las picadas cargadas para detectar novedades."
    >
      <AttendanceComparisonView />
    </DashboardShell>
  );
}
