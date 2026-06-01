import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import connectToDatabase from "@/lib/db/mongodb";
import { parseMonthKey } from "@/lib/planning/holidays";
import {
  buildAssignmentPayload,
  getMonthWeekOptions,
  getPreviousMonthKey,
  serializeScheduleAssignment,
  sortTemplatesByVariant,
} from "@/lib/planning/scheduleAssignments";
import BaseScheduleTemplate from "@/models/BaseScheduleTemplate";
import Employee from "@/models/Employee";
import Holiday from "@/models/Holiday";
import ScheduleAssignment from "@/models/ScheduleAssignment";

const VARIABLE_SCHEDULE_AREA_CODES = new Set(["ALM", "BOD"]);

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
    const employeeId = String(searchParams.get("employeeId") || "").trim();
    const query = { monthKey };

    if (branchCode) {
      query.branchCode = branchCode;
    }

    if (employeeId) {
      query.employee = employeeId;
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
    const action = String(body?.action || "").trim();

    if (action === "generate") {
      const branchCode = String(body?.branchCode || "").trim().toUpperCase();
      const areaCode = String(body?.areaCode || "").trim();
      const roleCode = String(body?.roleCode || "").trim();
      const employeeQuery = { isActive: { $ne: false } };

      if (branchCode) {
        employeeQuery.branchCode = branchCode;
      }

      if (areaCode) {
        employeeQuery.areaCode = VARIABLE_SCHEDULE_AREA_CODES.has(areaCode) ? areaCode : "__fixed_schedule_area__";
      } else {
        employeeQuery.areaCode = { $in: [...VARIABLE_SCHEDULE_AREA_CODES] };
      }

      if (roleCode) {
        employeeQuery.roleCode = roleCode;
      }

      const [employees, templates, holidays, previousAssignments, currentAssignments] = await Promise.all([
        Employee.find(employeeQuery).sort({ branchName: 1, areaName: 1, roleName: 1, fullName: 1 }).lean(),
        BaseScheduleTemplate.find({ isActive: { $ne: false } }).lean(),
        Holiday.find({ dateKey: { $regex: `^${monthKey}-` } }).lean(),
        ScheduleAssignment.find({ monthKey: getPreviousMonthKey(monthKey) }).lean(),
        ScheduleAssignment.find({ monthKey }).select({ employee: 1 }).lean(),
      ]);
      const weekOptions = getMonthWeekOptions(monthKey);
      const previousByEmployee = new Map(
        previousAssignments.map((assignment) => [assignment.employee?.toString?.() || "", assignment]),
      );
      const currentEmployeeIds = new Set(currentAssignments.map((assignment) => assignment.employee?.toString?.() || ""));
      const templatesByRole = templates.reduce((map, template) => {
        const key = `${template.areaCode || ""}|${template.roleCode || ""}`;

        if (!map.has(key)) {
          map.set(key, []);
        }

        map.get(key).push(template);
        return map;
      }, new Map());
      const employeesByBranchRole = employees.reduce((map, employee) => {
        const key = `${employee.branchCode || ""}|${employee.areaCode || ""}|${employee.roleCode || ""}`;

        if (!map.has(key)) {
          map.set(key, []);
        }

        map.get(key).push(employee);
        return map;
      }, new Map());
      const operations = [];
      const skipped = [];

      function hashText(value) {
        return [...String(value || "")].reduce((hash, char) => hash + char.charCodeAt(0), 0);
      }

      for (const [branchRoleKey, roleEmployees] of employeesByBranchRole.entries()) {
        const [, areaCodeForGroup = "", roleCodeForGroup = ""] = branchRoleKey.split("|");
        const roleKey = `${areaCodeForGroup}|${roleCodeForGroup}`;
        const roleTemplates = sortTemplatesByVariant(templatesByRole.get(roleKey) || []);

        if (!roleTemplates.length) {
          skipped.push(...roleEmployees.map((employee) => employee.fullName));
          continue;
        }

        roleEmployees.forEach((employee, employeeIndex) => {
          if (currentEmployeeIds.has(employee._id.toString())) {
            return;
          }

          const previousPlan = previousByEmployee.get(employee._id.toString())?.weeklyPlan || [];
          const previousLastTemplateId = previousPlan.at(-1)?.template?.toString?.() || "";
          const previousIndex = roleTemplates.findIndex(
            (template) => template._id.toString() === previousLastTemplateId,
          );
          const startOffset = previousIndex >= 0
            ? previousIndex + 1
            : hashText(`${monthKey}|${branchRoleKey}|${employee._id}`) + employeeIndex;
          const weeklyPlan = weekOptions.map((week, weekIndex) => ({
            ...week,
            templateDoc: roleTemplates[(startOffset + weekIndex) % roleTemplates.length],
          }));
          const payload = buildAssignmentPayload({
            employee,
            template: weeklyPlan[0]?.templateDoc,
            monthKey,
            holidays,
            weeklyPlan,
            notes: "Generado automaticamente por rotacion semanal.",
          });

          operations.push({
            updateOne: {
              filter: { monthKey, employee: employee._id },
              update: { $setOnInsert: payload },
              upsert: true,
            },
          });
        });
      }

      if (operations.length) {
        await ScheduleAssignment.bulkWrite(operations);
      }

      const assignmentQuery = { monthKey };

      if (branchCode) {
        assignmentQuery.branchCode = branchCode;
      }

      const assignments = await ScheduleAssignment.find(assignmentQuery)
        .sort({ employeeName: 1 })
        .lean();

      return NextResponse.json({
        message: operations.length
          ? `Horarios generados para ${operations.length} empleados.${skipped.length ? ` ${skipped.length} sin plantilla.` : ""}`
          : `No habia empleados pendientes para generar.${skipped.length ? ` ${skipped.length} sin plantilla.` : ""}`,
        assignments: assignments.map(serializeScheduleAssignment),
        skipped,
      });
    }

    const employeeId = String(body?.employeeId || "").trim();
    const weeklyPlanInput = Array.isArray(body?.weeklyPlan) ? body.weeklyPlan : [];
    const templateId = String(body?.templateId || weeklyPlanInput[0]?.templateId || "").trim();

    if (!employeeId || !templateId) {
      throw new Error("Debes seleccionar empleado y plantilla.");
    }

    const weeklyTemplateIds = weeklyPlanInput
      .map((week) => String(week?.templateId || "").trim())
      .filter(Boolean);
    const [employee, template, holidays, weeklyTemplates] = await Promise.all([
      Employee.findById(employeeId).lean(),
      BaseScheduleTemplate.findById(templateId).lean(),
      Holiday.find({ dateKey: { $regex: `^${monthKey}-` } }).lean(),
      weeklyTemplateIds.length
        ? BaseScheduleTemplate.find({ _id: { $in: weeklyTemplateIds }, isActive: { $ne: false } }).lean()
        : [],
    ]);

    if (!employee) {
      throw new Error("El empleado seleccionado no existe.");
    }

    if (!template) {
      throw new Error("La plantilla seleccionada no existe.");
    }

    const templatesById = new Map(weeklyTemplates.map((item) => [item._id.toString(), item]));
    const weeklyPlan = weeklyPlanInput
      .map((week) => ({
        weekStartKey: String(week?.weekStartKey || "").trim(),
        label: String(week?.label || "").trim(),
        templateDoc: templatesById.get(String(week?.templateId || "").trim()),
      }))
      .filter((week) => week.weekStartKey && week.templateDoc);

    const rotationTemplates = template.rotationGroup
      ? await BaseScheduleTemplate.find({
          areaCode: template.areaCode,
          roleCode: template.roleCode,
          rotationGroup: template.rotationGroup,
          isActive: true,
        }).lean()
      : [template];

    const payload = buildAssignmentPayload({
      employee,
      template,
      monthKey,
      holidays,
      rotationTemplates,
      weeklyPlan,
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
