import DashboardShell from "@/components/dashboard/DashboardShell";
import BranchManagement from "@/components/company/BranchManagement";
import { COMPANY_MODULE } from "@/lib/modules/company/module";

export const metadata = {
  title: "Sucursales | Empresa y configuración global",
};

export default function CompanyBranchesPage() {
  return (
    <DashboardShell
      moduleConfig={COMPANY_MODULE}
      title="Sucursales"
      description="Administra el catálogo global de sucursales que luego podrá ser reutilizado por otros módulos de la plataforma."
    >
      <BranchManagement />
    </DashboardShell>
  );
}
