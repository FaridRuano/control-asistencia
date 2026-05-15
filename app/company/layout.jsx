import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";

export default async function CompanyLayout({ children }) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect("/");
  }

  return children;
}
