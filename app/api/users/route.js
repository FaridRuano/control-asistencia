import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import connectToDatabase from "@/lib/db/mongodb";
import { normalizeUserPayload, serializeUser } from "@/lib/users";
import Employee from "@/models/Employee";
import User from "@/models/User";
import UserType from "@/models/UserType";

export async function GET() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  await connectToDatabase();

  const users = await User.find({}).sort({ employeeName: 1 }).lean();

  return NextResponse.json({
    users: users.map(serializeUser),
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
    const employeeId = String(body?.employeeId || "").trim();
    const employee = employeeId ? await Employee.findById(employeeId).lean() : null;
    const userType = await UserType.findOne({
      code: String(body?.accessRole || "").trim().toLowerCase(),
    }).lean();
    const payload = normalizeUserPayload(body, { employee, userType });
    const user = await User.create(payload);

    return NextResponse.json(
      {
        user: serializeUser(user),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const messages = {
        employeeId: "Este empleado ya tiene un usuario asignado.",
        username: "Ya existe un usuario con ese nombre de acceso.",
        email: "Ya existe un usuario con ese email.",
      };

      return NextResponse.json(
        { error: messages[field] || "Ya existe un usuario con esos datos." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error.message || "No se pudo crear el usuario." },
      { status: 400 },
    );
  }
}
