import NormalizeAttendanceView from "@/components/attendance/NormalizeAttendanceView";
import DashboardShell from "@/components/dashboard/DashboardShell";

export const metadata = {
  title: "Revisar carga | Control de Asistencia",
};

export default async function AttendanceUploadNormalizationPage({ params }) {
  const { id } = await params;

  return (
    <DashboardShell
      title="Revisar carga"
      description="Revisa los empleados detectados, guarda la normalización y publica las picadas válidas en el sistema."
    >
      <NormalizeAttendanceView uploadId={id} />
    </DashboardShell>
  );
}
