"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  BriefcaseBusiness,
  Edit3,
  Landmark,
  Plus,
  ReceiptText,
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
    return { search: "", page: 1 };
  }

  const params = new URLSearchParams(window.location.search);
  const initialPage = Number(params.get("page") || 1);

  return {
    search: params.get("q") || "",
    page: Number.isFinite(initialPage) && initialPage > 0 ? Math.floor(initialPage) : 1,
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

export default function EmployeeManagement() {
  const initialUrlState = useMemo(() => getInitialEmployeeUrlState(), []);
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [search, setSearch] = useState(initialUrlState.search);
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

  const replaceEmployeeUrlState = useCallback((nextSearch, nextPage) => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const cleanSearch = nextSearch.trim();
    const cleanPage = Math.max(1, Math.floor(Number(nextPage) || 1));

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

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return sortedEmployees;
    }

    return sortedEmployees.filter((employee) =>
      buildEmployeeSearchText(employee).includes(normalizedSearch),
    );
  }, [search, sortedEmployees]);

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
    replaceEmployeeUrlState(value, 1);
  }

  function handlePageChange(nextPage) {
    const cleanPage = Math.min(Math.max(1, nextPage), totalPages);

    setPage(cleanPage);
    replaceEmployeeUrlState(search, cleanPage);
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
            {search.trim() ? ` de ${sortedEmployees.length}` : ""}
          </p>

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
