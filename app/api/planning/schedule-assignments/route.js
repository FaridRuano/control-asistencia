import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import connectToDatabase from "@/lib/db/mongodb";
import { parseMonthKey } from "@/lib/planning/holidays";
import {
  buildAssignmentPayload,
  serializeScheduleAssignment,
} from "@/lib/planning/scheduleAssignments";
import BaseScheduleTemplate from "@/models/BaseScheduleTemplate";
import Employee from "@/models/Employee";
import Holiday from "@/models/Holiday";
import ScheduleAssignment from "@/models/ScheduleAssignment";

export async function GET(request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesion invalida o expirada." }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const { monthKey } = parseMonthKey(searchParams.get("month"));
    const branchCode = String(searchParams.get("branchCode") || "").trim().toUpperCase();
    const query = { monthKey };

    if (branchCode) {
      query.branchCode = branchCode;
    }

    const assignments = await ScheduleAssignment.find(query)
      .sort({ employeeName: 1 })
      .lean();

    return NextResponse.json({
      assignments: assignments.map(serializeScheduleAssignment),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar las asignaciones." },
      { status: 400 },
    );
  }
}

export async function POST(request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesion invalida o expirada." }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const body = await request.json();
    const { monthKey } = parseMonthKey(body?.monthKey);
    const employeeId = String(body?.employeeId || "").trim();
    const templateId = String(body?.templateId || "").trim();

    if (!employeeId || !templateId) {
      throw new Error("Debes seleccionar empleado y plantilla.");
    }

    const [employee, template, holidays] = await Promise.all([
      Employee.findById(employeeId).lean(),
      BaseScheduleTemplate.findById(templateId).lean(),
      Holiday.find({ dateKey: { $regex: `^${monthKey}-` } }).lean(),
    ]);

    if (!employee) {
      throw new Error("El empleado seleccionado no existe.");
    }

    if (!template) {
      throw new Error("La plantilla seleccionada no existe.");
    }

    const payload = buildAssignmentPayload({
      employee,
      template,
      monthKey,
      holidays,
      notes: body?.notes,
    });
    const assignment = await ScheduleAssignment.findOneAndUpdate(
      { monthKey, employee: employee._id },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    return NextResponse.json({
      message: "Horario asignado correctamente.",
      assignment: serializeScheduleAssignment(assignment),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo guardar la asignacion de horario." },
      { status: 400 },
    );
  }
}
