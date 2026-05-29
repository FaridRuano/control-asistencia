"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  BriefcaseBusiness,
  Edit3,
  Landmark,
  Layers3,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";

import CatalogDrawer from "@/components/catalog/CatalogDrawer";
import CatalogPageLoader from "@/components/catalog/CatalogPageLoader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FloatingNotice from "@/components/ui/FloatingNotice";
import { planningModulePath } from "@/lib/modules/planning/routes";
import EmployeeDetailModal from "./EmployeeDetailModal";
import EmployeeForm from "./EmployeeForm";
import styles from "./EmployeeManagement.module.scss";

const EMPLOYEES_PER_PAGE = 8;

function getInitialEmployeeUrlState() {
  if (typeof window === "undefined") {
    return { search: "", page: 1, area: "", role: "", branch: "" };
  }

  const params = new URLSearchParams(window.location.search);
  const initialPage = Number(params.get("page") || 1);

  return {
    search: params.get("q") || "",
    page: Number.isFinite(initialPage) && initialPage > 0 ? Math.floor(initialPage) : 1,
    area: params.get("area") || "",
    role: params.get("role") || "",
    branch: params.get("branch") || "",
  };
}

const INITIAL_FORM = {
  documentType: "cedula",
  dni: "",
  fullName: "",
  personalEmail: "",
  address: "",
  phone: "",
  branchId: "",
  branchCode: "",
  branchName: "",
  roleCode: "",
  roleName: "",
  areaCode: "",
  areaName: "",
  roleAssignments: [],
  salary: "",
  birthDate: "",
  biometricCode: "",
  isActive: true,
};

function mapEmployeeToForm(employee, branches = [], roles = []) {
  const branch = branches.find((candidate) => {
    const employeeBranch = String(employee.branchName || employee.branch || employee.branchCode || "").toUpperCase();

    return [candidate.id, candidate.code, candidate.name]
      .map((value) => String(value || "").toUpperCase())
      .includes(employeeBranch);
  });
  const roleAssignments = (employee.roleAssignments || [])
    .map((assignment) => {
      const roleMatch = roles.find((candidate) => candidate.code === assignment.code);

      return roleMatch
        ? {
            code: roleMatch.code,
            name: roleMatch.name,
            areaCode: roleMatch.areaCode,
            areaName: roleMatch.areaName,
            isPrimary: Boolean(assignment.isPrimary),
          }
        : assignment;
    })
    .filter((assignment) => assignment.code && assignment.name);
  const role = roles.find((candidate) => {
    const employeeRoleCode = String(employee.roleCode || "").toUpperCase();
    const employeeRoleName = String(employee.roleName || "").toUpperCase();

    return (
      String(candidate.code || "").toUpperCase() === employeeRoleCode ||
      String(candidate.name || "").toUpperCase() === employeeRoleName
    );
  });

  return {
    documentType: employee.documentType || "cedula",
    dni: employee.dni || "",
    fullName: employee.fullName || "",
    personalEmail: employee.personalEmail || "",
    address: employee.address || "",
    phone: employee.phone || "",
    branchId: employee.branchId || branch?.id || "",
    branchCode: employee.branchCode || branch?.code || "",
    branchName: employee.branchName || employee.branch || branch?.name || "",
    roleCode: role?.code || employee.roleCode || "",
    roleName: role?.name || employee.roleName || "",
    areaCode: role?.areaCode || employee.areaCode || "",
    areaName: role?.areaName || employee.areaName || "",
    roleAssignments: roleAssignments.length
      ? roleAssignments.map((assignment, index) => ({ ...assignment, isPrimary: index === 0 }))
      : role
        ? [{
            code: role.code,
            name: role.name,
            areaCode: role.areaCode,
            areaName: role.areaName,
            isPrimary: true,
          }]
        : [],
    salary: String(employee.salary ?? ""),
    birthDate: employee.birthDate || "",
    biometricCode: employee.biometricCode || "",
    isActive: employee.isActive !== false,
  };
}

function buildEmployeeSearchText(employee) {
  return [
    employee.documentType,
    employee.dni,
    employee.fullName,
    employee.personalEmail,
    employee.phone,
    employee.address,
    employee.branchName,
    employee.branch,
    employee.roleName,
    employee.areaName,
    ...(employee.roleAssignments || []).flatMap((role) => [role.name, role.areaName]),
    employee.biometricCode,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getEmployeeRoleCodes(employee) {
  const assignmentCodes = (employee.roleAssignments || [])
    .map((role) => role.code)
    .filter(Boolean);

  return new Set([employee.roleCode, ...assignmentCodes].filter(Boolean));
}

function getEmployeeAreaCodes(employee) {
  const assignmentAreaCodes = (employee.roleAssignments || [])
    .map((role) => role.areaCode)
    .filter(Boolean);

  return new Set([employee.areaCode, ...assignmentAreaCodes].filter(Boolean));
}

function getEmployeeBranchCodes(employee) {
  return new Set([employee.branchCode, employee.branchId, employee.branchName, employee.branch].filter(Boolean));
}

export default function EmployeeManagement() {
  const initialUrlState = useMemo(() => getInitialEmployeeUrlState(), []);
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [search, setSearch] = useState(initialUrlState.search);
  const [areaFilter, setAreaFilter] = useState(initialUrlState.area);
  const [roleFilter, setRoleFilter] = useState(initialUrlState.role);
  const [branchFilter, setBranchFilter] = useState(initialUrlState.branch);
  const [page, setPage] = useState(initialUrlState.page);
  const [editingEmployeeId, setEditingEmployeeId] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [isPending, startTransition] = useTransition();
  const noticeExitTimeoutRef = useRef(null);
  const noticeRemoveTimeoutRef = useRef(null);

  const clearNoticeTimers = useCallback(() => {
    if (noticeExitTimeoutRef.current) {
      window.clearTimeout(noticeExitTimeoutRef.current);
      noticeExitTimeoutRef.current = null;
    }

    if (noticeRemoveTimeoutRef.current) {
      window.clearTimeout(noticeRemoveTimeoutRef.current);
      noticeRemoveTimeoutRef.current = null;
    }
  }, []);

  const dismissNotice = useCallback(() => {
    clearNoticeTimers();
    setNotice((current) => (current ? { ...current, isLeaving: true } : null));
    noticeRemoveTimeoutRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeRemoveTimeoutRef.current = null;
    }, 240);
  }, [clearNoticeTimers]);

  const showNotice = useCallback((type, message) => {
    clearNoticeTimers();
    setNotice({ type, message, isLeaving: false });
    noticeExitTimeoutRef.current = window.setTimeout(dismissNotice, 4000);
  }, [clearNoticeTimers, dismissNotice]);

  useEffect(() => {
    return () => {
      clearNoticeTimers();
    };
  }, [clearNoticeTimers]);

  const replaceEmployeeUrlState = useCallback((nextState) => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const cleanSearch = String(nextState.search || "").trim();
    const cleanPage = Math.max(1, Math.floor(Number(nextState.page) || 1));
    const cleanArea = String(nextState.area || "").trim();
    const cleanRole = String(nextState.role || "").trim();
    const cleanBranch = String(nextState.branch || "").trim();

    if (cleanSearch) {
      params.set("q", cleanSearch);
    } else {
      params.delete("q");
    }

    if (cleanPage > 1) {
      params.set("page", String(cleanPage));
    } else {
      params.delete("page");
    }

    if (cleanArea) {
      params.set("area", cleanArea);
    } else {
      params.delete("area");
    }

    if (cleanRole) {
      params.set("role", cleanRole);
    } else {
      params.delete("role");
    }

    if (cleanBranch) {
      params.set("branch", cleanBranch);
    } else {
      params.delete("branch");
    }

    const queryString = params.toString();
    window.history.replaceState(null, "", queryString ? `?${queryString}` : window.location.pathname);
  }, []);

  async function loadData() {
    const [employeesResponse, branchesResponse, rolesResponse] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/branches"),
      fetch("/api/roles"),
    ]);
    const [employeesPayload, branchesPayload, rolesPayload] = await Promise.all([
      employeesResponse.json(),
      branchesResponse.json(),
      rolesResponse.json(),
    ]);

    if (!employeesResponse.ok) {
      throw new Error(employeesPayload.error || "No se pudo cargar la lista de empleados.");
    }

    if (!branchesResponse.ok) {
      throw new Error(branchesPayload.error || "No se pudo cargar la lista de sucursales.");
    }

    if (!rolesResponse.ok) {
      throw new Error(rolesPayload.error || "No se pudo cargar la lista de roles.");
    }

    setEmployees(employeesPayload.employees || []);
    setBranches(branchesPayload.branches || []);
    setRoles(rolesPayload.roles || []);
  }

  useEffect(() => {
    startTransition(async () => {
      try {
        await loadData();
      } catch (requestError) {
        showNotice("error", requestError.message);
      } finally {
        setIsLoading(false);
      }
    });
  }, [showNotice]);

  const sortedEmployees = useMemo(
    () => [...employees].sort((left, right) => left.fullName.localeCompare(right.fullName, "es")),
    [employees],
  );

  const areaOptions = useMemo(() => {
    const byCode = new Map();

    for (const role of roles) {
      if (role.areaCode && role.areaName) {
        byCode.set(role.areaCode, role.areaName);
      }
    }

    for (const employee of employees) {
      if (employee.areaCode && employee.areaName) {
        byCode.set(employee.areaCode, employee.areaName);
      }

      for (const assignment of employee.roleAssignments || []) {
        if (assignment.areaCode && assignment.areaName) {
          byCode.set(assignment.areaCode, assignment.areaName);
        }
      }
    }

    return [...byCode]
      .map(([code, name]) => ({ code, name }))
      .sort((left, right) => left.name.localeCompare(right.name, "es"));
  }, [employees, roles]);

  const roleOptions = useMemo(() => {
    const byCode = new Map();

    for (const role of roles) {
      if (role.code && role.name) {
        byCode.set(role.code, {
          code: role.code,
          name: role.name,
          areaCode: role.areaCode || "",
          areaName: role.areaName || "",
        });
      }
    }

    for (const employee of employees) {
      if (employee.roleCode && employee.roleName) {
        byCode.set(employee.roleCode, {
          code: employee.roleCode,
          name: employee.roleName,
          areaCode: employee.areaCode || "",
          areaName: employee.areaName || "",
        });
      }

      for (const assignment of employee.roleAssignments || []) {
        if (assignment.code && assignment.name) {
          byCode.set(assignment.code, {
            code: assignment.code,
            name: assignment.name,
            areaCode: assignment.areaCode || "",
            areaName: assignment.areaName || "",
          });
        }
      }
    }

    return [...byCode.values()]
      .filter((role) => !areaFilter || role.areaCode === areaFilter)
      .sort((left, right) => {
        const areaComparison = left.areaName.localeCompare(right.areaName, "es");

        return areaComparison || left.name.localeCompare(right.name, "es");
      });
  }, [areaFilter, employees, roles]);

  const branchOptions = useMemo(() => {
    const byKey = new Map();

    for (const branch of branches) {
      const code = branch.code || branch.id || branch.name;

      if (code) {
        byKey.set(code, {
          code,
          name: branch.name || branch.code || code,
        });
      }
    }

    for (const employee of employees) {
      const code = employee.branchCode || employee.branchId || employee.branchName || employee.branch;

      if (code) {
        byKey.set(code, {
          code,
          name: employee.branchName || employee.branch || employee.branchCode || code,
        });
      }
    }

    return [...byKey.values()].sort((left, right) => left.name.localeCompare(right.name, "es"));
  }, [branches, employees]);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return sortedEmployees.filter((employee) =>
      (!normalizedSearch || buildEmployeeSearchText(employee).includes(normalizedSearch)) &&
      (!areaFilter || getEmployeeAreaCodes(employee).has(areaFilter)) &&
      (!roleFilter || getEmployeeRoleCodes(employee).has(roleFilter)) &&
      (!branchFilter || getEmployeeBranchCodes(employee).has(branchFilter)),
    );
  }, [areaFilter, branchFilter, roleFilter, search, sortedEmployees]);

  const hasActiveFilters = Boolean(search.trim() || areaFilter || roleFilter || branchFilter);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / EMPLOYEES_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginationStart = (currentPage - 1) * EMPLOYEES_PER_PAGE;
  const paginatedEmployees = filteredEmployees.slice(
    paginationStart,
    paginationStart + EMPLOYEES_PER_PAGE,
  );

  const canSubmit = useMemo(() => Boolean(form.fullName.trim()), [form.fullName]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setEditingEmployeeId("");
    setForm(INITIAL_FORM);
  }, []);

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
    replaceEmployeeUrlState({
      search: value,
      page: 1,
      area: areaFilter,
      role: roleFilter,
      branch: branchFilter,
    });
  }

  function handleAreaFilterChange(value) {
    setAreaFilter(value);
    setRoleFilter("");
    setPage(1);
    replaceEmployeeUrlState({
      search,
      page: 1,
      area: value,
      role: "",
      branch: branchFilter,
    });
  }

  function handleRoleFilterChange(value) {
    setRoleFilter(value);
    setPage(1);
    replaceEmployeeUrlState({
      search,
      page: 1,
      area: areaFilter,
      role: value,
      branch: branchFilter,
    });
  }

  function handleBranchFilterChange(value) {
    setBranchFilter(value);
    setPage(1);
    replaceEmployeeUrlState({
      search,
      page: 1,
      area: areaFilter,
      role: roleFilter,
      branch: value,
    });
  }

  function clearFilters() {
    setSearch("");
    setAreaFilter("");
    setRoleFilter("");
    setBranchFilter("");
    setPage(1);
    replaceEmployeeUrlState({
      search: "",
      page: 1,
      area: "",
      role: "",
      branch: "",
    });
  }

  function handlePageChange(nextPage) {
    const cleanPage = Math.min(Math.max(1, nextPage), totalPages);

    setPage(cleanPage);
    replaceEmployeeUrlState({
      search,
      page: cleanPage,
      area: areaFilter,
      role: roleFilter,
      branch: branchFilter,
    });
  }

  function openEmployeeDetail(employee) {
    setSelectedEmployee(employee);
  }

  function handleBranchChange(branchId) {
    const branch = branches.find((candidate) => candidate.id === branchId);

    setForm((current) => ({
      ...current,
      branchId: branch?.id || "",
      branchCode: branch?.code || "",
      branchName: branch?.name || "",
    }));
  }

  function handleRoleChange(roleCodes) {
    const selectedRoleCodes = Array.isArray(roleCodes) ? roleCodes : [roleCodes].filter(Boolean);
    const selectedRoles = selectedRoleCodes
      .map((roleCode) => roles.find((candidate) => candidate.code === roleCode))
      .filter(Boolean);
    const primaryRole = selectedRoles[0] || null;

    setForm((current) => ({
      ...current,
      roleCode: primaryRole?.code || "",
      roleName: primaryRole?.name || "",
      areaCode: primaryRole?.areaCode || "",
      areaName: primaryRole?.areaName || "",
      roleAssignments: selectedRoles.map((role, index) => ({
        code: role.code,
        name: role.name,
        areaCode: role.areaCode,
        areaName: role.areaName,
        isPrimary: index === 0,
      })),
    }));
  }

  function openCreateDrawer() {
    setEditingEmployeeId("");
    setForm(INITIAL_FORM);
    setIsDrawerOpen(true);
  }

  function handleEdit(employee) {
    setSelectedEmployee(null);
    setEditingEmployeeId(employee.id);
    setForm(mapEmployeeToForm(employee, branches, roles));
    setIsDrawerOpen(true);
  }

  async function refreshEmployees() {
    const response = await fetch("/api/employees");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "No se pudo recargar la lista de empleados.");
    }

    setEmployees(payload.employees || []);
  }

  function handleSubmit(event) {
    event.preventDefault();

    startTransition(async () => {
      try {
        const method = editingEmployeeId ? "PATCH" : "POST";
        const endpoint = editingEmployeeId ? `/api/employees/${editingEmployeeId}` : "/api/employees";
        const response = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...form,
            salary: Number(form.salary || 0),
          }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo guardar el empleado.");
        }

        await refreshEmployees();
        showNotice("success", editingEmployeeId ? "Empleado actualizado correctamente." : "Empleado creado correctamente.");
        closeDrawer();
      } catch (requestError) {
        showNotice("error", requestError.message);
      }
    });
  }

  function requestDelete(employee) {
    setEmployeeToDelete(employee);
  }

  function confirmDelete() {
    if (!employeeToDelete) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/employees/${employeeToDelete.id}`, {
          method: "DELETE",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo eliminar el empleado.");
        }

        await refreshEmployees();
        setSelectedEmployee(null);
        showNotice("success", "Empleado eliminado correctamente.");

        if (editingEmployeeId === employeeToDelete.id) {
          closeDrawer();
        }

        setEmployeeToDelete(null);
      } catch (requestError) {
        showNotice("error", requestError.message);
      }
    });
  }

  if (isLoading) {
    return <CatalogPageLoader formVisible={false} />;
  }

  return (
    <div className="catalog-page-shell">
      <FloatingNotice notice={notice} onClose={dismissNotice} />

      <section className={`catalog-panel page-entrance ${styles.tablePanel}`}>
        <div className="catalog-toolbar">
          <p className="catalog-count">
            {filteredEmployees.length} empleado{filteredEmployees.length === 1 ? "" : "s"}
            {hasActiveFilters ? ` de ${sortedEmployees.length}` : ""}
          </p>

          <div className={styles.filterGrid}>
            <label className="catalog-search">
              <Search size={16} />
              <input
                type="search"
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Buscar empleado"
                className="catalog-search-input"
              />
            </label>

            <label className={styles.filterControl}>
              <Layers3 size={16} />
              <select
                value={areaFilter}
                onChange={(event) => handleAreaFilterChange(event.target.value)}
                aria-label="Filtrar por área"
              >
                <option value="">Todas las áreas</option>
                {areaOptions.map((area) => (
                  <option key={area.code} value={area.code}>
                    {area.name}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.filterControl}>
              <BriefcaseBusiness size={16} />
              <select
                value={roleFilter}
                onChange={(event) => handleRoleFilterChange(event.target.value)}
                aria-label="Filtrar por rol"
              >
                <option value="">Todos los roles</option>
                {roleOptions.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.areaName ? `${role.name} · ${role.areaName}` : role.name}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.filterControl}>
              <Landmark size={16} />
              <select
                value={branchFilter}
                onChange={(event) => handleBranchFilterChange(event.target.value)}
                aria-label="Filtrar por sucursal"
              >
                <option value="">Todas las sucursales</option>
                {branchOptions.map((branch) => (
                  <option key={branch.code} value={branch.code}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              className="catalog-button-ghost"
              onClick={clearFilters}
              aria-label="Limpiar filtros"
              title="Limpiar filtros"
            >
              <RotateCcw size={16} />
              Limpiar
            </button>
          ) : null}

          <button
            type="button"
            className="catalog-button-primary"
            onClick={openCreateDrawer}
            aria-haspopup="dialog"
            aria-expanded={isDrawerOpen}
            aria-label="Crear empleado"
            title="Crear empleado"
          >
            <Plus size={16} />
            Crear
          </button>
        </div>

        {filteredEmployees.length ? (
          <div className={`catalog-table-shell ${styles.tableShell}`}>
            <div className={`catalog-table-scroll ${styles.tableScroll}`}>
              <table className={`catalog-table ${styles.table}`}>
                <colgroup>
                  <col className={styles.statusColumn} />
                  <col className={styles.employeeColumn} />
                  <col className={styles.structureColumn} />
                  <col className={styles.actionsColumn} />
                </colgroup>
                <thead>
                  <tr>
                    <th aria-label="Estado" />
                    <th>Empleado</th>
                    <th>Estructura</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className={styles.employeeRow}
                      tabIndex={0}
                      onClick={() => openEmployeeDetail(employee)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openEmployeeDetail(employee);
                        }
                      }}
                    >
                      <td>
                        <span
                          className={`${styles.statusMarker} ${employee.isActive ? styles.statusActive : styles.statusInactive}`}
                          aria-label={employee.isActive ? "Empleado activo" : "Empleado inactivo"}
                          title={employee.isActive ? "Activo" : "Inactivo"}
                        />
                      </td>
                      <td>
                        <div className={styles.employeeName}>{employee.fullName}</div>
                        <span className={styles.employeeMeta}>
                          <UserRound size={14} />
                          {employee.organizationLabel || "Estructura pendiente"}
                        </span>
                      </td>
                      <td>
                        <div className={styles.stack}>
                          <span className={styles.badge}>
                            <Landmark size={14} />
                            {employee.branchName || employee.branch || "Sucursal pendiente"}
                          </span>
                          <span className={styles.badgeMuted}>
                            <BriefcaseBusiness size={14} />
                            {employee.roleName || "Rol pendiente"}
                          </span>
                        </div>
                      </td>
                      <td className={styles.actionsCell}>
                        <div className="catalog-row-actions">
                          <Link
                            href={`${planningModulePath("/payroll")}?employeeId=${employee.id}&employeeName=${encodeURIComponent(employee.fullName)}&mode=month`}
                            className="catalog-icon-button"
                            aria-label={`Ver nómina de ${employee.fullName}`}
                            title="Ir a nómina"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ReceiptText size={16} />
                          </Link>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleEdit(employee);
                            }}
                            className="catalog-icon-button"
                            aria-label={`Editar ${employee.fullName}`}
                            title="Editar empleado"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              requestDelete(employee);
                            }}
                            className="catalog-icon-button danger"
                            aria-label={`Eliminar ${employee.fullName}`}
                            title="Eliminar empleado"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.paginationBar}>
              <span>
                {paginationStart + 1}-{Math.min(paginationStart + EMPLOYEES_PER_PAGE, filteredEmployees.length)} de{" "}
                {filteredEmployees.length}
              </span>
              <div className={styles.paginationActions}>
                <button
                  type="button"
                  className="catalog-button-ghost"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Anterior
                </button>
                <strong>
                  {currentPage} / {totalPages}
                </strong>
                <button
                  type="button"
                  className="catalog-button-ghost"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="catalog-empty-state">
            {sortedEmployees.length
              ? "No encontramos empleados con ese criterio de búsqueda."
              : "Todavía no hay empleados registrados. Crea el primero desde el formulario."}
          </div>
        )}
      </section>

      <CatalogDrawer
        isOpen={isDrawerOpen}
        eyebrow={editingEmployeeId ? "Modo edición" : "Nuevo registro"}
        title={editingEmployeeId ? "Editar empleado" : "Formulario de empleado"}
        onClose={closeDrawer}
      >
        <EmployeeForm
          form={form}
          branches={branches}
          roles={roles}
          isEditing={Boolean(editingEmployeeId)}
          isSaving={isPending}
          canSubmit={canSubmit}
          onCancel={closeDrawer}
          onFieldChange={updateField}
          onBranchChange={handleBranchChange}
          onRoleChange={handleRoleChange}
          onSubmit={handleSubmit}
        />
      </CatalogDrawer>

      <EmployeeDetailModal
        employee={selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        onEdit={handleEdit}
        onDelete={requestDelete}
      />

      <ConfirmDialog
        isOpen={Boolean(employeeToDelete)}
        title="Eliminar empleado"
        message={`¿Deseas eliminar a "${employeeToDelete?.fullName || ""}"? Esta acción no se puede deshacer.`}
        confirmLabel={isPending ? "Eliminando..." : "Eliminar"}
        isPending={isPending}
        onCancel={() => setEmployeeToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
