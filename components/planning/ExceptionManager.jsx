"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addMonths, format, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import CatalogDrawer from "@/components/catalog/CatalogDrawer";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FloatingNotice from "@/components/ui/FloatingNotice";
import styles from "./ExceptionManager.module.scss";

const DEFAULT_TYPES = [
  { value: "absence", label: "Ausencia" },
  { value: "sick_leave", label: "Enfermedad" },
  { value: "permission", label: "Permiso" },
  { value: "schedule_change", label: "Cambio de horario" },
  { value: "replacement", label: "Reemplazo" },
  { value: "other", label: "Otro" },
];

const DEFAULT_RESOLUTIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "discount_day", label: "Descontar dia" },
  { value: "paid_leave", label: "Permiso pagado" },
  { value: "reschedule", label: "Reprogramar horario" },
  { value: "replacement", label: "Cubierto por reemplazo" },
  { value: "no_action", label: "Sin accion" },
  { value: "other", label: "Otra resolucion" },
];

const EMPTY_FORM = {
  id: "",
  employeeId: "",
  type: "absence",
  dateKey: format(new Date(), "yyyy-MM-dd"),
  endDateKey: "",
  registeredBy: "",
  authorizedBy: "",
  resolution: "pending",
  resolutionNotes: "",
  notes: "",
};

function buildExceptionForm(exception) {
  return {
    id: exception.id,
    employeeId: exception.employeeId,
    type: exception.type || "absence",
    dateKey: exception.dateKey || "",
    endDateKey: exception.endDateKey || "",
    registeredBy: exception.registeredBy || "",
    authorizedBy: exception.authorizedBy || "",
    resolution: exception.resolution || "pending",
    resolutionNotes: exception.resolutionNotes || "",
    notes: exception.notes || "",
  };
}

export default function ExceptionManager({
  eyebrow = "Control operativo",
  title = "Ajustes y excepciones",
  description = "Registra novedades reales por empleado y deja trazabilidad de la resolucion tomada.",
}) {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [employees, setEmployees] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [resolutions, setResolutions] = useState(DEFAULT_RESOLUTIONS);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [exceptionToDelete, setExceptionToDelete] = useState(null);
  const [notice, setNotice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const noticeExitTimeoutRef = useRef(null);
  const noticeRemoveTimeoutRef = useRef(null);
  const monthKey = format(monthDate, "yyyy-MM");
  const monthLabel = format(monthDate, "MMMM yyyy", { locale: es });

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.isActive !== false),
    [employees],
  );
  const selectedEmployee = useMemo(
    () => activeEmployees.find((employee) => employee.id === form.employeeId),
    [activeEmployees, form.employeeId],
  );
  const resolvedCount = exceptions.filter((exception) => exception.status === "resolved").length;
  const pendingCount = exceptions.filter((exception) => exception.resolution === "pending").length;
  const canSave = Boolean(form.employeeId && form.type && form.dateKey && form.registeredBy.trim());

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
    noticeExitTimeoutRef.current = window.setTimeout(() => {
      dismissNotice();
    }, 4000);
  }, [clearNoticeTimers, dismissNotice]);

  const loadExceptions = useCallback(async () => {
    const response = await fetch(`/api/planning/exceptions?month=${monthKey}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "No se pudieron cargar las excepciones.");
    }

    setExceptions(payload.exceptions || []);
    setTypes(payload.options?.types || DEFAULT_TYPES);
    setResolutions(payload.options?.resolutions || DEFAULT_RESOLUTIONS);
  }, [monthKey]);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setIsLoading(true);

      try {
        const [employeesResponse, exceptionsResponse] = await Promise.all([
          fetch("/api/employees"),
          fetch(`/api/planning/exceptions?month=${monthKey}`),
        ]);
        const [employeesPayload, exceptionsPayload] = await Promise.all([
          employeesResponse.json(),
          exceptionsResponse.json(),
        ]);

        if (!employeesResponse.ok) {
          throw new Error(employeesPayload.error || "No se pudieron cargar los empleados.");
        }

        if (!exceptionsResponse.ok) {
          throw new Error(exceptionsPayload.error || "No se pudieron cargar las excepciones.");
        }

        if (!isCancelled) {
          setEmployees(employeesPayload.employees || []);
          setExceptions(exceptionsPayload.exceptions || []);
          setTypes(exceptionsPayload.options?.types || DEFAULT_TYPES);
          setResolutions(exceptionsPayload.options?.resolutions || DEFAULT_RESOLUTIONS);
        }
      } catch (error) {
        if (!isCancelled) {
          showNotice("error", error.message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
      clearNoticeTimers();
    };
  }, [clearNoticeTimers, monthKey, showNotice]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateEditor() {
    setForm({
      ...EMPTY_FORM,
      dateKey: format(new Date(), "yyyy-MM-dd"),
    });
    setIsEditorOpen(true);
  }

  function openEditEditor(exception) {
    setForm(buildExceptionForm(exception));
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setForm(EMPTY_FORM);
    setIsEditorOpen(false);
  }

  function saveException(event) {
    event.preventDefault();

    if (!canSave) {
      showNotice("error", "Selecciona empleado, tipo, fecha y quien registro la excepcion.");
      return;
    }

    const endpoint = form.id ? `/api/planning/exceptions/${form.id}` : "/api/planning/exceptions";
    const method = form.id ? "PATCH" : "POST";

    startTransition(async () => {
      try {
        const response = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo guardar la excepcion.");
        }

        await loadExceptions();
        closeEditor();
        showNotice("success", payload.message || "Excepcion guardada correctamente.");
      } catch (error) {
        showNotice("error", error.message);
      }
    });
  }

  function confirmDeleteException() {
    if (!exceptionToDelete) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/planning/exceptions/${exceptionToDelete.id}`, {
          method: "DELETE",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo anular la excepcion.");
        }

        setExceptionToDelete(null);
        await loadExceptions();
        showNotice("success", "Excepcion anulada correctamente.");
      } catch (error) {
        showNotice("error", error.message);
      }
    });
  }

  return (
    <div className={styles.stack}>
      <FloatingNotice notice={notice} onClose={dismissNotice} />
      <ConfirmDialog
        isOpen={Boolean(exceptionToDelete)}
        title="Anular excepcion"
        message={`Deseas anular la excepcion de ${exceptionToDelete?.employeeName || ""}? Quedara fuera del control operativo.`}
        confirmLabel={isPending ? "Anulando..." : "Anular"}
        isPending={isPending}
        onCancel={() => setExceptionToDelete(null)}
        onConfirm={confirmDeleteException}
      />

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.description}>{description}</p>
          </div>

          <div className={styles.actionsGroup}>
            <div className={styles.monthControls}>
              <button type="button" onClick={() => setMonthDate((current) => subMonths(current, 1))} aria-label="Mes anterior">
                <ChevronLeft size={16} />
              </button>
              <div className={styles.monthPill}>
                <CalendarDays size={16} />
                <span>{monthLabel}</span>
              </div>
              <button type="button" onClick={() => setMonthDate((current) => addMonths(current, 1))} aria-label="Mes siguiente">
                <ChevronRight size={16} />
              </button>
            </div>

            <button type="button" className={styles.primaryButton} onClick={openCreateEditor}>
              <Plus size={16} />
              Nueva excepcion
            </button>
          </div>
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.metric}>
            <span>Registros</span>
            <strong>{exceptions.length}</strong>
          </div>
          <div className={styles.metric}>
            <span>Pendientes</span>
            <strong>{pendingCount}</strong>
          </div>
          <div className={styles.metric}>
            <span>Resueltas</span>
            <strong>{resolvedCount}</strong>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.listHeader}>
          <div>
            <h3>Excepciones registradas</h3>
            <p>{isLoading ? "Cargando..." : `Periodo ${monthLabel}`}</p>
          </div>
        </div>

        {exceptions.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Tipo / fecha</th>
                  <th>Trazabilidad</th>
                  <th>Resolucion</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {exceptions.map((exception) => (
                  <tr key={exception.id}>
                    <td>
                      <strong>{exception.employeeName}</strong>
                      <span>{[exception.branchName, exception.areaName, exception.roleName].filter(Boolean).join(" / ") || "Sin estructura"}</span>
                    </td>
                    <td>
                      <strong>{exception.typeLabel}</strong>
                      <span>
                        {exception.dateKey}
                        {exception.endDateKey ? ` hasta ${exception.endDateKey}` : ""}
                      </span>
                    </td>
                    <td>
                      <strong>Registro: {exception.registeredBy}</strong>
                      <span>Autorizo: {exception.authorizedBy || "Pendiente"}</span>
                    </td>
                    <td>
                      <span className={exception.resolution === "pending" ? styles.pendingPill : styles.resolvedPill}>
                        {exception.resolutionLabel}
                      </span>
                      {exception.resolutionNotes ? <small>{exception.resolutionNotes}</small> : null}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button type="button" onClick={() => openEditEditor(exception)} aria-label="Editar excepcion">
                          <Edit3 size={15} />
                        </button>
                        <button type="button" onClick={() => setExceptionToDelete(exception)} aria-label="Anular excepcion">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <AlertTriangle size={26} />
            <strong>No hay excepciones registradas para este mes.</strong>
            <span>Registra ausencias, permisos, cambios o decisiones operativas cuando ocurran.</span>
          </div>
        )}
      </section>

      <CatalogDrawer
        isOpen={isEditorOpen}
        eyebrow={form.id ? "Editar registro" : "Nuevo registro"}
        title={form.id ? "Editar excepcion" : "Registrar excepcion"}
        onClose={closeEditor}
      >
        <form className={styles.editorForm} onSubmit={saveException}>
          <label className={styles.field}>
            <span>Empleado</span>
            <select value={form.employeeId} onChange={(event) => updateForm("employeeId", event.target.value)}>
              <option value="">Seleccionar empleado</option>
              {activeEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </label>

          {selectedEmployee ? (
            <div className={styles.employeeSnapshot}>
              <strong>{selectedEmployee.branchName || selectedEmployee.branch || "Sin sucursal"}</strong>
              <span>{[selectedEmployee.areaName, selectedEmployee.roleName].filter(Boolean).join(" / ") || "Sin area o rol"}</span>
            </div>
          ) : null}

          <div className={styles.twoColumnGrid}>
            <label className={styles.field}>
              <span>Tipo</span>
              <select value={form.type} onChange={(event) => updateForm("type", event.target.value)}>
                {types.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Resolucion</span>
              <select value={form.resolution} onChange={(event) => updateForm("resolution", event.target.value)}>
                {resolutions.map((resolution) => (
                  <option key={resolution.value} value={resolution.value}>
                    {resolution.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.twoColumnGrid}>
            <label className={styles.field}>
              <span>Fecha</span>
              <input type="date" value={form.dateKey} onChange={(event) => updateForm("dateKey", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Fecha fin opcional</span>
              <input type="date" value={form.endDateKey} onChange={(event) => updateForm("endDateKey", event.target.value)} />
            </label>
          </div>

          <div className={styles.twoColumnGrid}>
            <label className={styles.field}>
              <span>Registrado por</span>
              <select value={form.registeredBy} onChange={(event) => updateForm("registeredBy", event.target.value)}>
                <option value="">Seleccionar empleado</option>
                {activeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.fullName}>
                    {employee.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Autorizado por</span>
              <select value={form.authorizedBy} onChange={(event) => updateForm("authorizedBy", event.target.value)}>
                <option value="">Pendiente</option>
                {activeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.fullName}>
                    {employee.fullName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span>Detalle de la resolucion</span>
            <textarea
              value={form.resolutionNotes}
              onChange={(event) => updateForm("resolutionNotes", event.target.value)}
              placeholder="Ej. Se decide descontar el dia por ausencia no justificada."
              rows={3}
            />
          </label>

          <label className={styles.field}>
            <span>Observacion interna</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              placeholder="Contexto adicional de la novedad"
              rows={3}
            />
          </label>

          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryButton} onClick={closeEditor} disabled={isPending}>
              Cancelar
            </button>
            <button type="submit" className={styles.primaryButton} disabled={!canSave || isPending}>
              <Save size={16} />
              {isPending ? "Guardando..." : "Guardar excepcion"}
            </button>
          </div>
        </form>
      </CatalogDrawer>
    </div>
  );
}
