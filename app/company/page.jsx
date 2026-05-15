import { redirect } from "next/navigation";

import { companyModulePath } from "@/lib/modules/company/routes";

export default function CompanyPage() {
  redirect(companyModulePath("/home"));
}
