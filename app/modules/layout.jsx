import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";

export default async function ModulesLayout({ children }) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect("/");
  }

  return children;
}
