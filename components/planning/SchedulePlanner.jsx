"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CalendarDays, Save } from "lucide-react";

import FloatingNotice from "@/components/ui/FloatingNotice";
import styles from "./SchedulePlanner.module.scss";

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function minutesLabel(minutes) {
  const value = Number(minutes) || 0;
  const hours = Math.floor(value / 60);
  const rest = value % 60;

  if (!hours) {
    return `${rest}m`;
  }

  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function dayTypeLabel(dayType) {
  const labels = {
    workday: "Laboral",
    weekend_overtime: "Extra",
    holiday: "Feriado",
    vacation: "Vacacion",
    off_day: "Descanso",
  };

  return labels[dayType] || dayType;
}

export default function SchedulePlanner() {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [branchCode, setBranchCode] = useState("");
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [draftTemplates, setDraftTemplates] = useState({});
  const [notice, setNotice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const noticeExitTimeoutRef = useRef(null);
  const noticeRemoveTimeoutRef = useRef(null);

  const assignmentsByEmployee = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.employeeId, assignment])),
    [assignments],
  );

  const employeesForBranch = useMemo(
    () =>
      employees.filter((employee) => {
        if (employee.isActive === false) {
          return false;
        }

        return !branchCode || employee.branchCode === branchCode;
      }),
    [branchCode, employees],
  );

  const templatesByRole = useMemo(() => {
    const grouped = new Map();

    templates.forEach((template) => {
      const key = template.roleCode || "";

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }

      grouped.get(key).push(template);
    });

    return grouped;
  }, [templates]);

  const summary = useMemo(
    () =>
      assignments.reduce(
        (totals, assignment) => ({
          assignedEmployees: totals.assignedEmployees + 1,
          workdays: totals.workdays + (assignment.summary?.workdays || 0),
          holidays: totals.holidays + (assignment.summary?.holidays || 0),
          extraordinaryDays: totals.extraordinaryDays + (assignment.summary?.extraordinaryDays || 0),
          supplementaryMinutes: totals.supplementaryMinutes + (assignment.summary?.supplementaryMinutes || 0),
        }),
        {
          assignedEmployees: 0,
          workdays: 0,
          holidays: 0,
          extraordinaryDays: 0,
          supplementaryMinutes: 0,
        },
      ),
    [assignments],
  );

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

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      try {
        const [employeesResponse, branchesResponse, templatesResponse] = await Promise.all([
          fetch("/api/employees"),
          fetch("/api/branches"),
          fetch("/api/planning/base-schedules"),
        ]);
        const [employeesPayload, branchesPayload, templatesPayload] = await Promise.all([
          employeesResponse.json(),
          branchesResponse.json(),
          templatesResponse.json(),
        ]);

        if (!employeesResponse.ok) {
          throw new Error(employeesPayload.error || "No se pudieron cargar los empleados.");
        }

        if (!branchesResponse.ok) {
          throw new Error(branchesPayload.error || "No se pudieron cargar las sucursales.");
        }

        if (!templatesResponse.ok) {
          throw new Error(templatesPayload.error || "No se pudieron cargar las plantillas.");
        }

        if (!isCancelled) {
          setEmployees(employeesPayload.employees || []);
          setBranches(branchesPayload.branches || []);
          setTemplates(templatesPayload.templates || []);
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
  }, [clearNoticeTimers, showNotice]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    let isCancelled = false;

    async function loadAssignments() {
      try {
        const params = new URLSearchParams({ month: monthKey });

        if (branchCode) {
          params.set("branchCode", branchCode);
        }

        const response = await fetch(`/api/planning/schedule-assignments?${params.toString()}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudieron cargar las asignaciones.");
        }

        if (!isCancelled) {
          setAssignments(payload.assignments || []);
          setDraftTemplates(
            Object.fromEntries((payload.assignments || []).map((assignment) => [assignment.employeeId, assignment.templateId])),
          );
        }
      } catch (error) {
        if (!isCancelled) {
          showNotice("error", error.message);
        }
      }
    }

    loadAssignments();

    return () => {
      isCancelled = true;
    };
  }, [branchCode, isLoading, monthKey, showNotice]);

  function assignTemplate(employeeId, templateId) {
    setDraftTemplates((current) => ({ ...current, [employeeId]: templateId }));
  }

  function saveAssignment(employee) {
    const templateId = draftTemplates[employee.id] || "";

    if (!templateId) {
      showNotice("error", "Selecciona una plantilla para el empleado.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/planning/schedule-assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            monthKey,
            employeeId: employee.id,
            templateId,
          }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo asignar el horario.");
        }

        setAssignments((current) => {
          const exists = current.some((assignment) => assignment.id === payload.assignment.id);

          return exists
            ? current.map((assignment) => (assignment.id === payload.assignment.id ? payload.assignment : assignment))
            : [...current, payload.assignment].sort((left, right) => left.employeeName.localeCompare(right.employeeName));
        });
        setDraftTemplates((current) => ({ ...current, [employee.id]: payload.assignment.templateId }));
        showNotice("success", payload.message);
      } catch (error) {
        showNotice("error", error.message);
      }
    });
  }

  if (isLoading) {
    return <div className={styles.loading}>Cargando programacion...</div>;
  }

  return (
    <div className={styles.layout}>
      <FloatingNotice notice={notice} onClose={dismissNotice} />

      <section className={styles.toolbar}>
        <div>
          <p className={styles.eyebrow}>Programacion</p>
          <h2>Horarios por empleado</h2>
        </div>
        <label>
          <span>Mes</span>
          <input type="month" value={monthKey} onChange={(event) => setMonthKey(event.target.value)} />
        </label>
        <label>
          <span>Sucursal</span>
          <select value={branchCode} onChange={(event) => setBranchCode(event.target.value)}>
            <option value="">Todas</option>
            {branches.map((branch) => (
              <option key={branch.code} value={branch.code}>{branch.name}</option>
            ))}
          </select>
        </label>
      </section>

      <section className={styles.summaryGrid}>
        <article>
          <span>Asignados</span>
          <strong>{summary.assignedEmployees}/{employeesForBranch.length}</strong>
        </article>
        <article>
          <span>Laborables</span>
          <strong>{summary.workdays}</strong>
        </article>
        <article>
          <span>Feriados</span>
          <strong>{summary.holidays}</strong>
        </article>
        <article>
          <span>Extraordinarios</span>
          <strong>{summary.extraordinaryDays}</strong>
        </article>
        <article>
          <span>Suplementarias</span>
          <strong>{minutesLabel(summary.supplementaryMinutes)}</strong>
        </article>
      </section>

      <section className={styles.tablePanel}>
        <div className={styles.tableHeader}>
          <CalendarDays size={18} />
          <span>{employeesForBranch.length} empleados para programar</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Sucursal</th>
                <th>Rol base</th>
                <th>Plantilla</th>
                <th>Resumen mensual</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {employeesForBranch.map((employee) => {
                const assignment = assignmentsByEmployee.get(employee.id);
                const candidateTemplates = templatesByRole.get(employee.roleCode) || templates;
                const selectedTemplateId = draftTemplates[employee.id] || "";

                return (
                  <tr key={employee.id}>
                    <td>
                      <strong>{employee.fullName}</strong>
                      <span>{employee.dni || "Sin documento"}</span>
                    </td>
                    <td>{employee.branchName || employee.branchCode || "Sin sucursal"}</td>
                    <td>
                      <strong>{employee.roleName || "Sin rol"}</strong>
                      <span>{employee.areaName || "Sin area"}</span>
                    </td>
                    <td>
                      <select value={selectedTemplateId} onChange={(event) => assignTemplate(employee.id, event.target.value)}>
                        <option value="">Seleccionar plantilla</option>
                        {candidateTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} - {template.roleName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {assignment ? (
                        <div className={styles.monthSummary}>
                          <span>{assignment.summary.workdays} laborables</span>
                          <span>{assignment.summary.restDays} descansos</span>
                          <span>{assignment.summary.holidays} feriados</span>
                          <span>{assignment.summary.extraordinaryDays} extras</span>
                        </div>
                      ) : (
                        <span className={styles.pending}>Pendiente</span>
                      )}
                    </td>
                    <td>
                      <button type="button" onClick={() => saveAssignment(employee)} disabled={isPending || !selectedTemplateId}>
                        <Save size={15} />
                        Guardar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.previewPanel}>
        <h3>Lectura del calculo</h3>
        <p>
          La plantilla semanal se expande solo sobre los dias reales del mes seleccionado.
          Si el mes empieza o termina a mitad de semana, el sistema toma unicamente esos dias.
          Los feriados registrados reemplazan el dia de plantilla como feriado.
        </p>
        <div className={styles.legend}>
          <span>{dayTypeLabel("workday")}</span>
          <span>{dayTypeLabel("weekend_overtime")}</span>
          <span>{dayTypeLabel("holiday")}</span>
          <span>{dayTypeLabel("off_day")}</span>
        </div>
      </section>
    </div>
  );
}
