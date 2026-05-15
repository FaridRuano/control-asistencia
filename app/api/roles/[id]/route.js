import { NextResponse } from "next/server";

import { createAuditLog, resolveAuditActor } from "@/lib/audit";
import { isAuthenticated } from "@/lib/auth";
import {
  normalizeRolePayload,
  resolveUniqueRoleCode,
  serializeRole,
} from "@/lib/company/roles";
import connectToDatabase from "@/lib/db/mongodb";
import Area from "@/models/Area";
import Role from "@/models/Role";

export async function PATCH(request, context) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const { id } = await context.params;
    const body = await request.json();
    const existingRole = await Role.findById(id).lean();

    if (!existingRole) {
      return NextResponse.json({ error: "Rol no encontrado." }, { status: 404 });
    }

    const payload = normalizeRolePayload(body);
    const area = await Area.findOne({ code: payload.areaCode }).lean();

    if (!area) {
      return NextResponse.json({ error: "El área seleccionada no existe." }, { status: 404 });
    }

    const existingRoles = await Role.find({ _id: { $ne: id } }, { code: 1 }).lean();
    const code = resolveUniqueRoleCode(
      payload.code,
      existingRoles.map((role) => role.code),
      payload.name,
    );

    const role = await Role.findByIdAndUpdate(
      id,
      { ...payload, code, areaName: area.name },
      { new: true, runValidators: true },
    );
    const actor = await resolveAuditActor();

    await createAuditLog({
      actor,
      action: "role.update",
      entityType: "role",
      entityId: role._id.toString(),
      entityLabel: role.name,
      route: `/api/roles/${id}`,
      details: {
        before: serializeRole(existingRole),
        after: serializeRole(role),
      },
    });

    return NextResponse.json({
      role: serializeRole(role),
    });
  } catch (error) {
    if (error?.code === 11000) {
      const fields = Object.keys(error.keyPattern || {});

      if (fields.includes("code")) {
        return NextResponse.json({ error: "Ya existe un rol con ese código." }, { status: 409 });
      }

      return NextResponse.json(
        { error: "Ya existe un rol con ese nombre dentro del área seleccionada." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error.message || "No se pudo actualizar el rol." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request, context) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  await connectToDatabase();
  const { id } = await context.params;
  const role = await Role.findByIdAndDelete(id);

  if (!role) {
    return NextResponse.json({ error: "Rol no encontrado." }, { status: 404 });
  }

  const actor = await resolveAuditActor();

  await createAuditLog({
    actor,
    action: "role.delete",
    entityType: "role",
    entityId: role._id.toString(),
    entityLabel: role.name,
    route: `/api/roles/${id}`,
    details: {
      deleted: serializeRole(role),
    },
  });

  return NextResponse.json({ success: true });
}
