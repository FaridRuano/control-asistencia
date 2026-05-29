import { redirect } from "next/navigation";

import { planningModulePath } from "@/lib/modules/planning/routes";

export default async function UploadNormalizationPage({ params }) {
  const { id } = await params;

  redirect(planningModulePath(`/attendance/uploads/${id}`));
}
