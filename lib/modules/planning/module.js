import { DASHBOARD_NAVIGATION } from "@/lib/dashboard/navigation";
import { planningModulePath } from "@/lib/modules/planning/routes";

export const PLANNING_MODULE = {
  key: "planning",
  title: "Planificación y control operativo",
  homeHref: planningModulePath("/home"),
  modulesHref: "/modules",
  navigation: DASHBOARD_NAVIGATION,
};
