import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import { BRANCH_OPTIONS } from "@/lib/branches";
import connectToDatabase from "@/lib/db/mongodb";
import Employee from "@/models/Employee";

function normalizeEmployeePayload(body) {
  const fullName = String(body?.fullName || "").trim();
  const biometricCode = String(body?.biometricCode || "").trim();
  const department = String(body?.department || "").trim();
  const salary = Number(body?.salary);
  const branch = String(body?.branch || "").trim().toUpperCase();

  if (!fullName) {
    throw new Error("El nombre completo es obligatorio.");
  }

  if (!Number.isFinite(salary) || salary < 0) {
    throw new Error("El sueldo debe ser un número válido mayor o igual a 0.");
  }

  if (!BRANCH_OPTIONS.includes(branch)) {
    throw new Error("La sucursal debe ser AMBATO o SALCEDO.");
  }

  return {
    biometricCode,
    fullName,
    salary,
    branch,
    department,
  };
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
      employee: {
        id: employee._id.toString(),
        biometricCode: employee.biometricCode || "",
        fullName: employee.fullName,
        salary: employee.salary || 0,
        branch: employee.branch,
        department: employee.department || "",
        isActive: employee.isActive,
      },
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
