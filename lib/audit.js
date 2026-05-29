import AuditLog from "@/models/AuditLog";
import { getAuthenticatedUser } from "@/lib/auth";

export async function resolveAuditActor() {
  const user = await getAuthenticatedUser();

  return user?.employeeName || user?.username || "admin";
}

export async function createAuditLog({
  actor,
  action,
  entityType,
  entityId = "",
  entityLabel = "",
  route = "",
  details = {},
}) {
  return AuditLog.create({
    actor: actor || "admin",
    action,
    entityType,
    entityId,
    entityLabel,
    route,
    details,
  });
}
