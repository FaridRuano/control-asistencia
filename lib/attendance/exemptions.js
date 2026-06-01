const PLANNED_ATTENDANCE_EXEMPT_AREA_CODES = new Set(["CP"]);
const DEFAULT_ATTENDANCE_PAYROLL_POLICY = {
  scheduleAffectsSalary: true,
  appliesSupplementaryHours: true,
  appliesExtraordinaryHours: true,
  label: "Ajustado al plan",
};

function employeeRoleKey(employee = {}) {
  const areaCode = String(employee?.areaCode || "").trim().toUpperCase();
  const roleCode = String(employee?.roleCode || "").trim().toUpperCase();

  return `${areaCode}|${roleCode}`;
}

function payrollNeutralRoleRule(laborRules = {}, employee = {}) {
  const roleKey = employeeRoleKey(employee);

  return (laborRules?.payrollNeutralRoleRules || []).find((rule) =>
    `${String(rule?.areaCode || "").trim().toUpperCase()}|${String(rule?.roleCode || "").trim().toUpperCase()}` === roleKey,
  );
}

export function attendancePayrollPolicy(employee = {}, laborRules = {}) {
  const rule = payrollNeutralRoleRule(laborRules, employee);

  if (!rule) {
    if (PLANNED_ATTENDANCE_EXEMPT_AREA_CODES.has(String(employee?.areaCode || "").trim().toUpperCase())) {
      return {
        ...DEFAULT_ATTENDANCE_PAYROLL_POLICY,
        scheduleAffectsSalary: false,
        label: "Ajustado al plan por viajes",
      };
    }

    return DEFAULT_ATTENDANCE_PAYROLL_POLICY;
  }

  return {
    scheduleAffectsSalary: rule.scheduleAffectsSalary ?? false,
    appliesSupplementaryHours: rule.appliesSupplementaryHours ?? false,
    appliesExtraordinaryHours: rule.appliesExtraordinaryHours ?? false,
    label: rule.label || DEFAULT_ATTENDANCE_PAYROLL_POLICY.label,
  };
}

export function isAttendancePayrollNeutral(employee = {}, laborRules = {}) {
  const policy = attendancePayrollPolicy(employee, laborRules);

  return !policy.scheduleAffectsSalary && !policy.appliesSupplementaryHours && !policy.appliesExtraordinaryHours;
}

export function isPlannedAttendanceExempt(employee = {}, laborRules = {}) {
  return !attendancePayrollPolicy(employee, laborRules).scheduleAffectsSalary;
}

export function plannedAttendanceExemptionLabel(employee = {}, laborRules = {}) {
  return attendancePayrollPolicy(employee, laborRules).label || DEFAULT_ATTENDANCE_PAYROLL_POLICY.label;
}
