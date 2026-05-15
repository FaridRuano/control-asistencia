import AuditLog from "@/models/AuditLog";

export async function resolveAuditActor() {
  return "admin";
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
