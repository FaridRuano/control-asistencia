function normalizeDateValue(value) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return null;
  }

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    throw new Error("La fecha de nacimiento no es válida.");
  }

  return date;
}

export function normalizeEmployeePayload(body) {
  const fullName = String(body?.fullName || "").trim().toUpperCase();
  const salary = Number(body?.salary || 0);

  if (!fullName) {
    throw new Error("El nombre completo es obligatorio.");
  }

  if (!Number.isFinite(salary) || salary < 0) {
    throw new Error("El sueldo debe ser un número válido mayor o igual a 0.");
  }

  const branchCode = String(body?.branchCode || body?.branch || "").trim().toUpperCase();
  const branchName = String(body?.branchName || body?.branch || "").trim().toUpperCase();

  return {
    documentType: String(body?.documentType || "cedula").trim().toLowerCase() || "cedula",
    dni: String(body?.dni || "").trim().toUpperCase(),
    fullName,
    personalEmail: String(body?.personalEmail || "").trim().toLowerCase(),
    address: String(body?.address || "").trim(),
    phone: String(body?.phone || "").trim(),
    branchId: String(body?.branchId || "").trim(),
    branchCode,
    branchName,
    branch: branchName || branchCode,
    areaCode: String(body?.areaCode || "").trim(),
    areaName: String(body?.areaName || "").trim().toUpperCase(),
    roleCode: String(body?.roleCode || "").trim(),
    roleName: String(body?.roleName || "").trim().toUpperCase(),
    department: String(body?.department || body?.areaName || "").trim().toUpperCase(),
    salary,
    birthDate: normalizeDateValue(body?.birthDate),
    biometricCode: String(body?.biometricCode || "").trim(),
    isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
  };
}

export function serializeEmployee(employee) {
  const areaName = employee.areaName || employee.department || "";
  const roleName = employee.roleName || "";
  const organizationLabel = [areaName, roleName].filter(Boolean).join(" · ");

  return {
    id: employee._id.toString(),
    documentType: employee.documentType || "cedula",
    dni: employee.dni || "",
    fullName: employee.fullName || "",
    personalEmail: employee.personalEmail || "",
    address: employee.address || "",
    phone: employee.phone || "",
    branchId: employee.branchId || "",
    branchCode: employee.branchCode || "",
    branchName: employee.branchName || employee.branch || "",
    branch: employee.branchName || employee.branch || employee.branchCode || "",
    areaCode: employee.areaCode || "",
    areaName,
    roleCode: employee.roleCode || "",
    roleName,
    organizationLabel,
    salary: employee.salary || 0,
    birthDate: employee.birthDate ? employee.birthDate.toISOString().slice(0, 10) : "",
    biometricCode: employee.biometricCode || "",
    department: employee.department || "",
    isActive: employee.isActive !== false,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}
