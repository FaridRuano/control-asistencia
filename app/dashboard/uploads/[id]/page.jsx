import DashboardShell from "@/components/dashboard/DashboardShell";
import NormalizeAttendanceView from "@/components/attendance/NormalizeAttendanceView";

export const metadata = {
  title: "Normalizar carga | Control de Asistencia",
};

export default async function UploadNormalizationPage({ params }) {
  const { id } = await params;

  return (
    <DashboardShell
      title="Normalización de carga"
      description="Recupera un archivo ya guardado, procésalo de nuevo y revisa los empleados detectados junto con sus picadas antes de continuar con reglas de negocio."
    >
      <NormalizeAttendanceView uploadId={id} />
    </DashboardShell>
  );
}
