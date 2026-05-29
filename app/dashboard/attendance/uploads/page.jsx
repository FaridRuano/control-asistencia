import UploadAttendanceForm from "@/components/attendance/UploadAttendanceForm";
import DashboardShell from "@/components/dashboard/DashboardShell";

export const metadata = {
  title: "Cargar picadas | Control de Asistencia",
};

export default function AttendanceUploadsPage() {
  return (
    <DashboardShell
      title="Cargar picadas"
      description="Sube el archivo del biométrico, selecciona la sucursal de origen y revisa la normalización antes de publicar picadas."
    >
      <UploadAttendanceForm />
    </DashboardShell>
  );
}
