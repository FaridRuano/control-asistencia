import DashboardShell from "@/components/dashboard/DashboardShell";
import UploadAttendanceForm from "@/components/attendance/UploadAttendanceForm";

export const metadata = {
  title: "Cargas | Control de Asistencia",
};

export default function DashboardUploadsPage() {
  return (
    <DashboardShell
      title="Cargas de asistencia"
      description="Sube el reporte horizontal del biométrico, procesa las picadas y revisa el resumen preliminar antes de continuar con el análisis."
    >
      <UploadAttendanceForm />
    </DashboardShell>
  );
}
