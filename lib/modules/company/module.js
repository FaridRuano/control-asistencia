import { COMPANY_MODULE_NAVIGATION } from "@/lib/modules/company/navigation";
import { companyModulePath } from "@/lib/modules/company/routes";

export const COMPANY_MODULE = {
  key: "company",
  title: "Empresa y configuración global",
  homeHref: companyModulePath("/home"),
  modulesHref: "/modules",
  navigation: COMPANY_MODULE_NAVIGATION,
};
