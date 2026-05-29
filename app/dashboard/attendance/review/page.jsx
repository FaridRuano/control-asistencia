import AttendancePunchReview from "@/components/attendance/AttendancePunchReview";
import DashboardShell from "@/components/dashboard/DashboardShell";

export const metadata = {
  title: "Revisar picadas | Control de Asistencia",
};

export default function AttendanceReviewPage() {
  return (
    <DashboardShell
      title="Revisar picadas"
      description="Consulta, agrega, edita o elimina picadas con auditoría obligatoria por cada cambio manual."
    >
      <AttendancePunchReview />
    </DashboardShell>
  );
}
