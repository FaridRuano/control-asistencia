"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Edit3, Landmark, PencilLine, Plus, Trash2, UserRound, X } from "lucide-react";
import styles from "./EmployeeManagement.module.scss";

const INITIAL_FORM = {
  biometricCode: "",
  fullName: "",
  salary: "",
  branch: "AMBATO",
  department: "",
};

const BRANCH_OPTIONS = ["AMBATO", "SALCEDO"];

function mapEmployeeToForm(employee) {
  return {
    biometricCode: employee.biometricCode || "",
    fullName: employee.fullName || "",
    salary: String(employee.salary ?? ""),
    branch: employee.branch || "AMBATO",
    department: employee.department || "",
  };
}

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
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

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
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
            <span className={styles.label}>Código biométrico opcional</span>
            <input
              value={form.biometricCode}
              onChange={(event) => updateField("biometricCode", event.target.value)}
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Departamento opcional</span>
            <input
              value={form.department}
              onChange={(event) => updateField("department", event.target.value)}
              className={styles.input}
            />
          </label>

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
            {sortedEmployees.length} empleado{sortedEmployees.length === 1 ? "" : "s"} registrado
            {sortedEmployees.length === 1 ? "" : "s"}.
          </p>
        </div>

        {sortedEmployees.length ? (
          <div className={styles.tableWrap}>
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nombre completo</th>
                    <th>Sueldo</th>
                    <th>Sucursal</th>
                    <th>Identificación</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEmployees.map((employee) => (
                    <tr key={employee.id}>
                      <td>
                        <div className={styles.name}>{employee.fullName}</div>
                        <div className={styles.metaLine}>
                          <span className={styles.metaItem}>
                            <UserRound size={14} />
                            {employee.department || "Sin departamento"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.amount}>
                          ${Number(employee.salary || 0).toFixed(2)}
                        </div>
                      </td>
                      <td>
                        <span className={styles.branchBadge}>
                          <Landmark size={14} />
                          {employee.branch}
                        </span>
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
            Todavía no hay empleados registrados. Usa el formulario para crear el primero.
          </div>
        )}
      </section>
      </div>
    </>
  );
}
