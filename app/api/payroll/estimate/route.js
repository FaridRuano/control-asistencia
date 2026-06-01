import { NextResponse } from "next/server";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { isAuthenticated } from "@/lib/auth";
import connectToDatabase from "@/lib/db/mongodb";
import { serializeEmployee } from "@/lib/employees";
import calculatePayrollEstimate from "@/lib/payroll/calculatePayrollEstimate";
import { resolveMonthlyBaseHours } from "@/lib/payroll/monthlyBaseHours";
import AttendancePunch from "@/models/AttendancePunch";
import Employee from "@/models/Employee";
import LaborRuleConfig from "@/models/LaborRuleConfig";
import PayrollIncompleteDayDecision from "@/models/PayrollIncompleteDayDecision";
import PayrollLateDecision from "@/models/PayrollLateDecision";
import PayrollSupplementaryDecision from "@/models/PayrollSupplementaryDecision";
import WorkSchedule from "@/models/WorkSchedule";

function parseMonthParam(value) {
  if (!value) {
    return null;
  }

  const parsed = parse(String(value), "yyyy-MM", new Date());
  return isValid(parsed) ? parsed : null;
}

export async function GET(request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  try {
    const employeeId = String(request.nextUrl.searchParams.get("employeeId") || "").trim();
    const month = parseMonthParam(request.nextUrl.searchParams.get("month"));

    if (!employeeId) {
      throw new Error("Debes indicar el empleado.");
    }

    if (!month) {
      throw new Error("Debes indicar el mes a estimar.");
    }

    await connectToDatabase();

    const employee = await Employee.findById(employeeId).lean();

    if (!employee) {
      return NextResponse.json({ error: "Empleado no encontrado." }, { status: 404 });
    }

    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    const weekKeys = [
      ...new Set(
        eachDayOfInterval({ start: monthStart, end: monthEnd }).map((date) =>
          format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        ),
      ),
    ];

    const [schedules, punches, supplementaryDecisions, lateDecisions, incompleteDayDecisions, rules] =
      await Promise.all([
      WorkSchedule.find({
        employee: employeeId,
        weekKey: { $in: weekKeys },
      }).lean(),
      AttendancePunch.find({
        employee: employeeId,
        punchedAt: {
          $gte: monthStart,
          $lte: monthEnd,
        },
      })
        .sort({ punchedAt: 1 })
        .lean(),
      PayrollSupplementaryDecision.find({
        employee: employeeId,
        date: {
          $gte: monthStart,
          $lte: monthEnd,
        },
      }).lean(),
      PayrollLateDecision.find({
        employee: employeeId,
        date: {
          $gte: monthStart,
          $lte: monthEnd,
        },
      }).lean(),
      PayrollIncompleteDayDecision.find({
        employee: employeeId,
        date: {
          $gte: monthStart,
          $lte: monthEnd,
        },
      }).lean(),
      LaborRuleConfig.findOne({ key: "default" }).lean(),
    ]);

    if (!schedules.length) {
      return NextResponse.json({
        employee: serializeEmployee(employee),
        month: {
          value: format(month, "yyyy-MM"),
        },
        summary: null,
        rows: [],
        message: "No hay horarios configurados para este empleado en ese mes.",
      });
    }

    const supplementaryByDate = new Map(
      supplementaryDecisions.map((item) => [
        format(item.date, "yyyy-MM-dd"),
        {
          decision: item.decision,
          candidateHours: item.candidateHours || 0,
        },
      ]),
    );

    const lateByDate = new Map(
      lateDecisions.map((item) => [
        format(item.date, "yyyy-MM-dd"),
        {
          confirmed: Boolean(item.confirmed),
          lateMinutes: item.lateMinutes || 0,
        },
      ]),
    );

    const incompleteDayByDate = new Map(
      incompleteDayDecisions.map((item) => [
        format(item.date, "yyyy-MM-dd"),
        {
          decision: item.decision,
          punchCount: item.punchCount || 0,
        },
      ]),
    );

    const estimate = calculatePayrollEstimate({
      employee,
      monthDate: month,
      punches,
      schedules,
      monthlyBaseHours: (await resolveMonthlyBaseHours({
        monthKey: format(month, "yyyy-MM"),
        year: month.getFullYear(),
        monthIndex: month.getMonth(),
        dailyBaseHours: Number(rules?.dailyBaseHours) || 8,
      })).hourlyDivisor,
      supplementaryByDate,
      lateByDate,
      incompleteDayByDate,
      laborRules: rules || {},
    });

    return NextResponse.json(estimate);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo calcular la estimación de nómina." },
      { status: 400 },
    );
  }
}
