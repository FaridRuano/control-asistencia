import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import connectToDatabase from "@/lib/db/mongodb";
import { normalizeEmployeePayload, serializeEmployee } from "@/lib/employees";
import Employee from "@/models/Employee";

export async function PATCH(request, context) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const { id } = await context.params;
    const body = await request.json();
    const payload = normalizeEmployeePayload(body);

    const employee = await Employee.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!employee) {
      return NextResponse.json({ error: "Empleado no encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      employee: serializeEmployee(employee),
    });
  } catch (error) {
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const message =
        field === "fullName"
          ? "Ya existe un empleado con ese nombre completo."
          : "El código biométrico ya está asignado a otro empleado.";

      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json(
      { error: error.message || "No se pudo actualizar el empleado." },
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
  const employee = await Employee.findByIdAndDelete(id);

  if (!employee) {
    return NextResponse.json({ error: "Empleado no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
