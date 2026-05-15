import { BRANCH_OPTIONS, buildOrganizationSummary, getAreaConfig, getRoleConfig } from "@/lib/organization";

export function normalizeEmployeePayload(body, options = {}) {
  const allowUnassignedOrganization = Boolean(options.allowUnassignedOrganization);
  const fullName = String(body?.fullName || "").trim();
  const biometricCode = String(body?.biometricCode || "").trim();
  const salary = Number(body?.salary);
  const branch = String(body?.branch || "").trim().toUpperCase();
  const areaCode = String(body?.areaCode || "").trim();
  const roleCode = String(body?.roleCode || "").trim();
  const legacyDepartment = String(body?.department || "").trim();

  if (!fullName) {
    throw new Error("El nombre completo es obligatorio.");
  }

  if (!Number.isFinite(salary) || salary < 0) {
    throw new Error("El sueldo debe ser un número válido mayor o igual a 0.");
  }

  if (!BRANCH_OPTIONS.includes(branch)) {
    throw new Error("La sucursal debe ser AMBATO o SALCEDO.");
  }

  const area = getAreaConfig(areaCode);

  if (!areaCode && allowUnassignedOrganization) {
    return {
      biometricCode,
      fullName,
      salary,
      branch,
      areaCode: "",
      areaName: "",
      roleCode: "",
      roleName: "",
      department: legacyDepartment,
    };
  }

  if (!area) {
    throw new Error("Debes seleccionar un área válida.");
  }

  const role = getRoleConfig(area.code, roleCode);

  if (!role) {
    throw new Error("Debes seleccionar un rol válido para el área elegida.");
  }

  return {
    biometricCode,
    fullName,
    salary,
    branch,
    areaCode: area.code,
    areaName: area.label,
    roleCode: role.code,
    roleName: role.label,
    department: legacyDepartment || area.label,
  };
}

export function serializeEmployee(employee) {
  const serialized = {
    id: employee._id.toString(),
    biometricCode: employee.biometricCode || "",
    fullName: employee.fullName,
    salary: employee.salary || 0,
    branch: employee.branch,
    department: employee.department || "",
    areaCode: employee.areaCode || "",
    areaName: employee.areaName || "",
    roleCode: employee.roleCode || "",
    roleName: employee.roleName || "",
    organizationLabel: buildOrganizationSummary(employee),
    isActive: employee.isActive,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };

  return serialized;
}
