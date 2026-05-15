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

export async function GET() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  await connectToDatabase();

  const roles = await Role.find({})
    .sort({ areaName: 1, name: 1 })
    .lean();

  return NextResponse.json({
    roles: roles.map(serializeRole),
  });
}

export async function POST(request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const body = await request.json();
    const payload = normalizeRolePayload(body);
    const area = await Area.findOne({ code: payload.areaCode }).lean();

    if (!area) {
      return NextResponse.json({ error: "El área seleccionada no existe." }, { status: 404 });
    }

    const existingRoles = await Role.find({}, { code: 1 }).lean();
    const code = resolveUniqueRoleCode(
      payload.code,
      existingRoles.map((role) => role.code),
      payload.name,
    );

    const role = await Role.create({
      ...payload,
      code,
      areaName: area.name,
    });
    const actor = await resolveAuditActor();

    await createAuditLog({
      actor,
      action: "role.create",
      entityType: "role",
      entityId: role._id.toString(),
      entityLabel: role.name,
      route: "/api/roles",
      details: {
        after: serializeRole(role),
      },
    });

    return NextResponse.json(
      {
        role: serializeRole(role),
      },
      { status: 201 },
    );
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
      { error: error.message || "No se pudo crear el rol." },
      { status: 400 },
    );
  }
}
