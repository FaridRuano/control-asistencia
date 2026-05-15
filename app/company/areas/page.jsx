import DashboardShell from "@/components/dashboard/DashboardShell";
import AreaManagement from "@/components/company/AreaManagement";
import { COMPANY_MODULE } from "@/lib/modules/company/module";

export const metadata = {
  title: "Áreas | Empresa y configuración global",
};

export default function CompanyAreasPage() {
  return (
    <DashboardShell
      moduleConfig={COMPANY_MODULE}
      title="Áreas"
      description="Administra el catálogo global de áreas que podrá reutilizarse en cualquier sucursal y en distintos módulos de la plataforma."
    >
      <AreaManagement />
    </DashboardShell>
  );
}
