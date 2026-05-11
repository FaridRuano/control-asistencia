import { NextResponse } from "next/server";
import { startOfDay } from "date-fns";

import parseAttendanceFile from "@/lib/attendance/parseAttendanceFile";
import calculateDailyAttendance from "@/lib/attendance/calculateDailyAttendance";
import connectToDatabase from "@/lib/db/mongodb";
import AttendancePunch from "@/models/AttendancePunch";
import AttendanceUpload from "@/models/AttendanceUpload";
import DailyAttendance from "@/models/DailyAttendance";
import Employee from "@/models/Employee";
import WorkSchedule from "@/models/WorkSchedule";
import { isAuthenticated } from "@/lib/auth";

function groupPunchesByDay(punches) {
  const grouped = new Map();

  punches.forEach((punch) => {
    const dateKey = startOfDay(punch.punchedAt).toISOString();

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }

    grouped.get(dateKey).push(punch.punchedAt);
  });

  return grouped;
}

export async function POST(request) {
  let uploadDocument = null;

  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return NextResponse.json(
        { error: "Sesión inválida o expirada." },
        { status: 401 },
      );
    }

    await connectToDatabase();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json(
        { error: "Debes adjuntar un archivo Excel válido." },
        { status: 400 },
      );
    }

    uploadDocument = await AttendanceUpload.create({
      fileName: file.name,
      status: "processing",
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsedFile = parseAttendanceFile({
      buffer,
      fileName: file.name,
    });

    const employeesPayload = [];
    let totalDailyAttendances = 0;

    for (const parsedEmployee of parsedFile.employees) {
      const employeeDocument = await Employee.findOneAndUpdate(
        { biometricCode: parsedEmployee.biometricCode },
        {
          biometricCode: parsedEmployee.biometricCode,
          name: parsedEmployee.name,
          department: parsedEmployee.department,
          isActive: true,
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      );

      const punchDocuments = parsedEmployee.punches.map((punch) => ({
        upload: uploadDocument._id,
        employee: employeeDocument._id,
        punchedAt: punch.punchedAt,
        rawValue: punch.rawValue,
      }));

      if (punchDocuments.length) {
        await AttendancePunch.insertMany(punchDocuments, { ordered: false });
      }

      const groupedByDay = groupPunchesByDay(parsedEmployee.punches);
      const dayDates = [...groupedByDay.keys()].map((value) => new Date(value));
      const dayIndexes = [...new Set(dayDates.map((date) => date.getDay()))];
      const schedules = await WorkSchedule.find({
        employee: employeeDocument._id,
        dayOfWeek: { $in: dayIndexes },
      }).lean();

      const scheduleByDay = new Map(
        schedules.map((schedule) => [schedule.dayOfWeek, schedule]),
      );

      const dailyAttendanceDocuments = [];

      groupedByDay.forEach((dayPunches, dateKey) => {
        const date = new Date(dateKey);
        const schedule = scheduleByDay.get(date.getDay()) || null;
        const summary = calculateDailyAttendance({
          date,
          punches: dayPunches,
          schedule,
        });

        dailyAttendanceDocuments.push({
          upload: uploadDocument._id,
          employee: employeeDocument._id,
          date: summary.date,
          checkIn: summary.checkIn,
          lunchOut: summary.lunchOut,
          lunchIn: summary.lunchIn,
          checkOut: summary.checkOut,
          workedMinutes: summary.workedMinutes,
          lateMinutes: summary.lateMinutes,
          earlyLeaveMinutes: summary.earlyLeaveMinutes,
          overtimeMinutes: summary.overtimeMinutes,
          status: summary.status,
          notes: summary.notes,
        });
      });

      if (dailyAttendanceDocuments.length) {
        await DailyAttendance.insertMany(dailyAttendanceDocuments, {
          ordered: false,
        });
      }

      totalDailyAttendances += dailyAttendanceDocuments.length;

      employeesPayload.push({
        employeeId: employeeDocument._id.toString(),
        biometricCode: employeeDocument.biometricCode,
        name: employeeDocument.name,
        department: employeeDocument.department,
        punchCount: parsedEmployee.punches.length,
        firstPunch: parsedEmployee.punches[0]?.punchedAt || null,
        lastPunch:
          parsedEmployee.punches[parsedEmployee.punches.length - 1]?.punchedAt || null,
        calculatedDays: dailyAttendanceDocuments.length,
      });
    }

    uploadDocument.month = parsedFile.month || null;
    uploadDocument.year = parsedFile.year || null;
    uploadDocument.status = "processed";
    uploadDocument.totalEmployees = parsedFile.employees.length;
    uploadDocument.totalPunches = parsedFile.totalPunches;
    await uploadDocument.save();

    return NextResponse.json({
      message: "Archivo procesado correctamente.",
      upload: {
        id: uploadDocument._id.toString(),
        fileName: uploadDocument.fileName,
        month: uploadDocument.month,
        year: uploadDocument.year,
        status: uploadDocument.status,
      },
      summary: {
        totalEmployees: parsedFile.employees.length,
        totalPunches: parsedFile.totalPunches,
        totalDailyAttendances,
      },
      employees: employeesPayload,
      parserLogs: parsedFile.logs,
    });
  } catch (error) {
    console.error("attendance-upload-error", error);

    if (uploadDocument) {
      uploadDocument.status = "failed";
      await uploadDocument.save();
    }

    return NextResponse.json(
      {
        error:
          error.message || "Ocurrió un error inesperado procesando la asistencia.",
      },
      { status: 500 },
    );
  }
}
