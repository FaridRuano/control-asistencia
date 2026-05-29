import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import connectToDatabase from "@/lib/db/mongodb";
import { normalizeEmployeePayload, serializeEmployee } from "@/lib/employees";
import Employee from "@/models/Employee";
import User from "@/models/User";

export async function GET(_request, context) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  await connectToDatabase();
  const { id } = await context.params;
  const employee = await Employee.findById(id).lean();

  if (!employee) {
    return NextResponse.json({ error: "Empleado no encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    employee: serializeEmployee(employee),
  });
}

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
      const message = field === "dni"
        ? "Ya existe un empleado con ese DNI."
        : "El código biométrico ya está asignado a otro empleado.";

      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json(
      { error: error.message || "No se pudo actualizar el empleado." },
      { status: 400 },
    );
  }
}

function parseTerminationDate(value) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    throw new Error("La fecha de salida es obligatoria.");
  }

  const date = new Date(`${normalizedValue}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("La fecha de salida no es valida.");
  }

  return date;
}

export async function DELETE(request, context) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const terminationDate = parseTerminationDate(body?.terminationDate);
    const employee = await Employee.findByIdAndUpdate(
      id,
      {
        $set: {
          isActive: false,
          terminationDate,
        },
      },
      { new: true },
    );

    if (!employee) {
      return NextResponse.json({ error: "Empleado no encontrado." }, { status: 404 });
    }

    await User.updateMany({ employeeId: id }, { $set: { isActive: false } });

    return NextResponse.json({
      success: true,
      employee: serializeEmployee(employee),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo despedir el empleado." },
      { status: 400 },
    );
  }
}
