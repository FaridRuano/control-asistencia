"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Edit3,
  Landmark,
  PencilLine,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  TimerReset,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { planningModulePath } from "@/lib/modules/planning/routes";
import { BRANCH_OPTIONS, getRoleConfig, getRolesForArea, ORGANIZATION_AREAS } from "@/lib/organization";
import styles from "./EmployeeManagement.module.scss";

const INITIAL_FORM = {
  biometricCode: "",
  fullName: "",
  salary: "",
  branch: "AMBATO",
  areaCode: "",
  roleCode: "",
};

function mapEmployeeToForm(employee) {
  return {
    biometricCode: employee.biometricCode || "",
    fullName: employee.fullName || "",
    salary: String(employee.salary ?? ""),
    branch: employee.branch || "AMBATO",
    areaCode: employee.areaCode || "",
    roleCode: employee.roleCode || "",
  };
}

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [search, setSearch] = useState("");
  const [editingEmployeeId, setEditingEmployeeId] = useState("");
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const toastTimeoutRef = useRef(null);
  const canUseDOM = typeof document !== "undefined";

  useEffect(() => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/employees");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo cargar la lista de empleados.");
        }

        setEmployees(payload.employees || []);
      } catch (requestError) {
        setError(requestError.message);
      }
    });
  }, []);

  const sortedEmployees = useMemo(
    () =>
      [...employees].sort((left, right) =>
        left.fullName.localeCompare(right.fullName, "es"),
      ),
    [employees],
  );
  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return sortedEmployees;
    }

    return sortedEmployees.filter((employee) => {
      const haystack = [
        employee.fullName,
        employee.branch,
        employee.biometricCode,
        employee.areaName,
        employee.roleName,
        employee.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [search, sortedEmployees]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const roleOptions = useMemo(() => getRolesForArea(form.areaCode), [form.areaCode]);
  const selectedRoleConfig = useMemo(
    () => getRoleConfig(form.areaCode, form.roleCode),
    [form.areaCode, form.roleCode],
  );

  function updateField(name, value) {
    setForm((current) => {
      if (name === "areaCode") {
        return {
          ...current,
          areaCode: value,
          roleCode: "",
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });
  }

  function resetForm() {
    setEditingEmployeeId("");
    setForm(INITIAL_FORM);
  }

  function showSuccessToast(message) {
    setSuccess(message);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setSuccess("");
      toastTimeoutRef.current = null;
    }, 5000);
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
    setError("");
    setSuccess("");

    startTransition(async () => {
      try {
        const method = editingEmployeeId ? "PATCH" : "POST";
        const endpoint = editingEmployeeId
          ? `/api/employees/${editingEmployeeId}`
          : "/api/employees";

        const response = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...form,
            salary: Number(form.salary),
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo guardar el empleado.");
        }

        await refreshEmployees();
        showSuccessToast(
          editingEmployeeId
            ? "Empleado actualizado correctamente."
            : "Empleado creado correctamente.",
        );
        resetForm();
      } catch (requestError) {
        setError(requestError.message);
      }
    });
  }

  function handleEdit(employee) {
    setError("");
    setSuccess("");
    setEditingEmployeeId(employee.id);
    setForm(mapEmployeeToForm(employee));
  }

  function requestDelete(employee) {
    setEmployeeToDelete(employee);
  }

  function confirmDelete() {
    if (!employeeToDelete) {
      return;
    }

    setError("");
    setSuccess("");

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
        showSuccessToast("Empleado eliminado correctamente.");

        if (editingEmployeeId === employeeToDelete.id) {
          resetForm();
        }

        setEmployeeToDelete(null);
      } catch (requestError) {
        setError(requestError.message);
      }
    });
  }

  return (
    <>
      {success ? (
        <div className={styles.toast} role="status" aria-live="polite">
          <div className={styles.toastIcon}>
            <CheckCircle2 size={18} />
          </div>
          <div className={styles.toastContent}>
            <p className={styles.toastTitle}>Operación exitosa</p>
            <p className={styles.toastMessage}>{success}</p>
          </div>
          <button
            type="button"
            onClick={() => setSuccess("")}
            className={styles.toastClose}
            aria-label="Cerrar notificación"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      {canUseDOM && employeeToDelete
        ? createPortal(
            <div
              className={styles.modalOverlay}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-employee-title"
            >
              <div className={styles.modal}>
                <h3 id="delete-employee-title" className={styles.modalTitle}>
                  Confirmar eliminación
                </h3>
                <p className={styles.modalText}>
                  ¿Deseas eliminar a <strong>{employeeToDelete.fullName}</strong>? Esta acción no se puede deshacer.
                </p>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setEmployeeToDelete(null)}
                    disabled={isPending}
                    className={styles.buttonGhost}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    disabled={isPending}
                    className={styles.buttonDanger}
                  >
                    {isPending ? "Eliminando..." : "Eliminar empleado"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <div className={styles.layout}>
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>
          {editingEmployeeId ? "Editar empleado" : "Registrar empleado"}
        </h2>
        <p className={styles.panelDescription}>
          El nombre completo será la referencia principal para relacionar al empleado con el reporte Excel.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>Nombre completo</span>
            <input
              value={form.fullName}
              onChange={(event) => updateField("fullName", event.target.value)}
              className={styles.input}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Sueldo</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.salary}
              onChange={(event) => updateField("salary", event.target.value)}
              className={styles.input}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Sucursal</span>
            <select
              value={form.branch}
              onChange={(event) => updateField("branch", event.target.value)}
              className={styles.select}
              required
            >
              {BRANCH_OPTIONS.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Área</span>
            <select
              value={form.areaCode}
              onChange={(event) => updateField("areaCode", event.target.value)}
              className={styles.select}
              required
            >
              <option value="">Selecciona un área</option>
              {ORGANIZATION_AREAS.map((area) => (
                <option key={area.code} value={area.code}>
                  {area.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Rol</span>
            <select
              value={form.roleCode}
              onChange={(event) => updateField("roleCode", event.target.value)}
              className={styles.select}
              required
              disabled={!form.areaCode}
            >
              <option value="">Selecciona un rol</option>
              {roleOptions.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Código biométrico opcional</span>
            <input
              value={form.biometricCode}
              onChange={(event) => updateField("biometricCode", event.target.value)}
              className={styles.input}
            />
          </label>

          {selectedRoleConfig ? (
            <div className={styles.ruleCard}>
              <p className={styles.ruleTitle}>Regla base inicial del rol</p>
              <div className={styles.ruleGrid}>
                <span className={styles.ruleChip}>
                  <BriefcaseBusiness size={14} />
                  {selectedRoleConfig.scheduleProfile}
                </span>
                <span className={styles.ruleChip}>
                  <TimerReset size={14} />
                  Almuerzo {selectedRoleConfig.lunchMinutes} min
                </span>
                {selectedRoleConfig.weeklyRotation ? (
                  <span className={styles.ruleChip}>
                    <ShieldCheck size={14} />
                    {selectedRoleConfig.weeklyRotation}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className={styles.actions}>
            <button
              type="submit"
              disabled={isPending}
              className={styles.buttonPrimary}
            >
              <span className={styles.buttonIcon}>
                {editingEmployeeId ? <PencilLine size={16} /> : <Plus size={16} />}
              </span>
              {isPending
                ? "Guardando..."
                : editingEmployeeId
                  ? "Actualizar"
                  : "Crear empleado"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              disabled={isPending}
              className={styles.buttonGhost}
            >
              Limpiar
            </button>
          </div>
        </form>

        {error ? <div className={`${styles.feedback} ${styles.error}`}>{error}</div> : null}
      </section>

      <section>
        <div className={styles.toolbar}>
          <p className={styles.count}>
            {filteredEmployees.length} empleado{filteredEmployees.length === 1 ? "" : "s"} visible
            {filteredEmployees.length === 1 ? "" : "s"}
            {search.trim() ? ` de ${sortedEmployees.length}` : ""}.
          </p>
          <label className={styles.searchField}>
            <Search size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar empleado"
              className={styles.searchInput}
            />
          </label>
        </div>

        {filteredEmployees.length ? (
          <div className={styles.tableWrap}>
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nombre completo</th>
                    <th>Sueldo</th>
                    <th>Estructura</th>
                    <th>Identificación</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id}>
                      <td>
                        <div className={styles.name}>{employee.fullName}</div>
                        <div className={styles.metaLine}>
                          <span className={styles.metaItem}>
                            <UserRound size={14} />
                            {employee.organizationLabel}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.amount}>
                          ${Number(employee.salary || 0).toFixed(2)}
                        </div>
                      </td>
                      <td>
                        <div className={styles.structureStack}>
                          <span className={styles.branchBadge}>
                            <Landmark size={14} />
                            {employee.branch}
                          </span>
                          <span className={styles.roleBadge}>
                            <BriefcaseBusiness size={14} />
                            {employee.roleName || "Rol pendiente"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.identityBlock}>
                          <span className={styles.identityLabel}>Código biométrico</span>
                          <span className={styles.identityValue}>
                            {employee.biometricCode || "s/n"}
                          </span>
                        </div>
                      </td>
                        <td>
                          <div className={styles.rowActions}>
                          <Link
                            href={`${planningModulePath("/payroll")}?employeeId=${employee.id}&employeeName=${encodeURIComponent(employee.fullName)}&mode=month`}
                            className={styles.miniLink}
                            aria-label={`Ver nómina de ${employee.fullName}`}
                            title="Ir a nómina"
                          >
                            <ReceiptText size={16} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleEdit(employee)}
                            className={styles.miniButton}
                            aria-label={`Editar ${employee.fullName}`}
                            title="Editar empleado"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(employee)}
                            className={styles.miniDanger}
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
          </div>
        ) : (
          <div className={styles.empty}>
            {sortedEmployees.length
              ? "No encontramos empleados con ese criterio de búsqueda."
              : "Todavía no hay empleados registrados. Usa el formulario para crear el primero."}
          </div>
        )}
      </section>
      </div>
    </>
  );
}
