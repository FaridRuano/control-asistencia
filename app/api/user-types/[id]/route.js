import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import connectToDatabase from "@/lib/db/mongodb";
import {
  isProtectedUserTypeCode,
  normalizeUserTypePayload,
  serializeUserType,
} from "@/lib/user-types";
import UserType from "@/models/UserType";

export async function PATCH(request, { params }) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const { id } = await params;
    const body = await request.json();
    const existingType = await UserType.findById(id).lean();

    if (!existingType) {
      return NextResponse.json({ error: "Rol de acceso no encontrado." }, { status: 404 });
    }

    if (isProtectedUserTypeCode(existingType.code)) {
      return NextResponse.json(
        { error: "El rol de acceso Administrador está protegido y no se puede editar." },
        { status: 403 },
      );
    }

    const payload = normalizeUserTypePayload(body);
    const userType = await UserType.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!userType) {
      return NextResponse.json({ error: "Rol de acceso no encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      userType: serializeUserType(userType),
    });
  } catch (error) {
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const message = field === "name"
        ? "Ya existe un tipo de usuario con ese nombre."
        : "Ya existe un tipo de usuario con ese código.";

      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json(
      { error: error.message || "No se pudo actualizar el tipo de usuario." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request, { params }) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  await connectToDatabase();

  const { id } = await params;
  const userType = await UserType.findById(id).lean();

  if (!userType) {
    return NextResponse.json({ error: "Rol de acceso no encontrado." }, { status: 404 });
  }

  if (isProtectedUserTypeCode(userType.code)) {
    return NextResponse.json(
      { error: "El rol de acceso Administrador está protegido y no se puede eliminar." },
      { status: 403 },
    );
  }

  await UserType.findByIdAndDelete(id);

  return NextResponse.json({ success: true });
}
