import { redirect } from "next/navigation";
import { planningModulePath } from "@/lib/modules/planning/routes";

export const metadata = {
  title: "Planificación y control operativo | Control de Asistencia",
};

export default function PlanningModuleEntryPage() {
  redirect(planningModulePath("/home"));
}
