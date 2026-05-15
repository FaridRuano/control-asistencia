import { redirect } from "next/navigation";
import { planningModulePath } from "@/lib/modules/planning/routes";

export default function DashboardPage() {
  redirect(planningModulePath("/home"));
}
