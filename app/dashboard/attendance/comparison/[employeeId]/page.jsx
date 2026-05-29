import AttendanceComparisonDetail from "@/components/attendance/AttendanceComparisonDetail";
import DashboardShell from "@/components/dashboard/DashboardShell";

export const metadata = {
  title: "Reporte de asistencia | Control de Asistencia",
};

export default async function AttendanceComparisonDetailPage({ params, searchParams }) {
  const { employeeId } = await params;
  const {
    month = "",
    branchCode = "",
    areaCode = "",
    roleCode = "",
  } = await searchParams;

  return (
    <DashboardShell
      title="Reporte de asistencia"
      description="Detalle diario del horario asignado, picadas registradas y novedades detectadas."
    >
      <AttendanceComparisonDetail
        employeeId={employeeId}
        initialFilters={{ month, branchCode, areaCode, roleCode }}
      />
    </DashboardShell>
  );
}
