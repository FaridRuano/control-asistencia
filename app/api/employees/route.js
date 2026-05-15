import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import connectToDatabase from "@/lib/db/mongodb";
import { normalizeEmployeePayload, serializeEmployee } from "@/lib/employees";
import Employee from "@/models/Employee";

export async function GET() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  await connectToDatabase();

  const employees = await Employee.find({})
    .sort({ fullName: 1 })
    .lean();

  return NextResponse.json({
    employees: employees.map(serializeEmployee),
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
    const payload = normalizeEmployeePayload(body);

    const employee = await Employee.create(payload);

    return NextResponse.json(
      {
        employee: serializeEmployee(employee),
      },
      { status: 201 },
    );
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
      { error: error.message || "No se pudo crear el empleado." },
      { status: 400 },
    );
  }
}
