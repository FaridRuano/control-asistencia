import DashboardShell from "@/components/dashboard/DashboardShell";
import EmployeeScheduleDetail from "@/components/planning/EmployeeScheduleDetail";

export const metadata = {
  title: "Detalle de horario | Control de Asistencia",
};

export default async function EmployeeMonthlySchedulePage({ params, searchParams }) {
  const { employeeId } = await params;
  const {
    month = "",
    branchCode = "",
    areaCode = "",
    roleCode = "",
  } = await searchParams;

  return (
    <DashboardShell
      title="Detalle de horario"
      description="Revisa el mes planificado por empleado, separado por semanas y días."
    >
      <EmployeeScheduleDetail
        employeeId={employeeId}
        initialMonth={month}
        returnFilters={{ branchCode, areaCode, roleCode }}
      />
    </DashboardShell>
  );
}
