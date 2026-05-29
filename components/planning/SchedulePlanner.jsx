"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, RefreshCw, Save, Wand2 } from "lucide-react";

import FloatingNotice from "@/components/ui/FloatingNotice";
import { planningModulePath } from "@/lib/modules/planning/routes";
import { getMonthWeekOptions, sortTemplatesByVariant } from "@/lib/planning/scheduleAssignments";
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

function buildDraftWeeklyPlan(assignment, weeks) {
  const planByWeek = new Map((assignment?.weeklyPlan || []).map((week) => [week.weekStartKey, week.templateId]));

  if (!planByWeek.size && assignment?.templateId) {
    return Object.fromEntries(weeks.map((week) => [week.weekStartKey, assignment.templateId]));
  }

  return Object.fromEntries(weeks.map((week) => [week.weekStartKey, planByWeek.get(week.weekStartKey) || ""]));
}

function buildPlannerUrl(filters) {
  const params = new URLSearchParams();

  if (filters.monthKey) {
    params.set("month", filters.monthKey);
  }

  if (filters.branchCode) {
    params.set("branchCode", filters.branchCode);
  }

  if (filters.areaCode) {
    params.set("areaCode", filters.areaCode);
  }

  if (filters.roleCode) {
    params.set("roleCode", filters.roleCode);
  }

  const query = params.toString();

  return `${planningModulePath("/planning/monthly")}${query ? `?${query}` : ""}`;
}

export default function SchedulePlanner({ initialFilters = {} }) {
  const router = useRouter();
  const [monthKey, setMonthKey] = useState(initialFilters.month || currentMonthKey());
  const [branchCode, setBranchCode] = useState(initialFilters.branchCode || "");
  const [areaCode, setAreaCode] = useState(initialFilters.areaCode || "");
  const [roleCode, setRoleCode] = useState(initialFilters.roleCode || "");
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [draftWeeklyPlans, setDraftWeeklyPlans] = useState({});
  const [notice, setNotice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const noticeExitTimeoutRef = useRef(null);
  const noticeRemoveTimeoutRef = useRef(null);

  const assignmentsByEmployee = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.employeeId, assignment])),
    [assignments],
  );
  const weekOptions = useMemo(() => getMonthWeekOptions(monthKey), [monthKey]);

  const areaOptions = useMemo(() => {
    const options = new Map();

    employees.forEach((employee) => {
      if (employee.isActive === false) {
        return;
      }

      if (branchCode && employee.branchCode !== branchCode) {
        return;
      }

      if (employee.areaCode) {
        options.set(employee.areaCode, employee.areaName || employee.areaCode);
      }
    });

    return [...options.entries()].sort((left, right) => left[1].localeCompare(right[1], "es"));
  }, [branchCode, employees]);

  const roleOptions = useMemo(() => {
    const options = new Map();

    employees.forEach((employee) => {
      if (employee.isActive === false) {
        return;
      }

      if (branchCode && employee.branchCode !== branchCode) {
        return;
      }

      if (areaCode && employee.areaCode !== areaCode) {
        return;
      }

      if (employee.roleCode) {
        options.set(employee.roleCode, employee.roleName || employee.roleCode);
      }
    });

    return [...options.entries()].sort((left, right) => left[1].localeCompare(right[1], "es"));
  }, [areaCode, branchCode, employees]);

  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        if (employee.isActive === false) {
          return false;
        }

        if (branchCode && employee.branchCode !== branchCode) {
          return false;
        }

        if (areaCode && employee.areaCode !== areaCode) {
          return false;
        }

        return !roleCode || employee.roleCode === roleCode;
      }),
    [areaCode, branchCode, employees, roleCode],
  );

  const templatesByRole = useMemo(() => {
    const grouped = new Map();

    templates.forEach((template) => {
      const key = `${template.areaCode || ""}:${template.roleCode || ""}`;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }

      grouped.get(key).push(template);
    });

    return new Map([...grouped.entries()].map(([key, value]) => [key, sortTemplatesByVariant(value)]));
  }, [templates]);

  const filteredAssignments = useMemo(
    () => assignments.filter((assignment) => filteredEmployees.some((employee) => employee.id === assignment.employeeId)),
    [assignments, filteredEmployees],
  );

  const allFilteredEmployeesGenerated = filteredEmployees.length > 0
    && filteredEmployees.every((employee) => assignmentsByEmployee.has(employee.id));

  const summary = useMemo(
    () =>
      filteredAssignments.reduce(
        (totals, assignment) => ({
          assignedEmployees: totals.assignedEmployees + 1,
          workdays: totals.workdays + (assignment.summary?.workdays || 0),
          extraordinaryDays: totals.extraordinaryDays + (assignment.summary?.extraordinaryDays || 0),
          supplementaryMinutes: totals.supplementaryMinutes + (assignment.summary?.supplementaryMinutes || 0),
        }),
        {
          assignedEmployees: 0,
          workdays: 0,
          extraordinaryDays: 0,
          supplementaryMinutes: 0,
        },
      ),
    [filteredAssignments],
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

  function replaceFilters(nextFilters) {
    router.replace(buildPlannerUrl({
      monthKey,
      branchCode,
      areaCode,
      roleCode,
      ...nextFilters,
    }), { scroll: false });
  }

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
          setDraftWeeklyPlans(
            Object.fromEntries(
              (payload.assignments || []).map((assignment) => [
                assignment.employeeId,
                buildDraftWeeklyPlan(assignment, weekOptions),
              ]),
            ),
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
  }, [branchCode, isLoading, monthKey, showNotice, weekOptions]);

  function assignTemplate(employeeId, weekStartKey, templateId) {
    setDraftWeeklyPlans((current) => ({
      ...current,
      [employeeId]: {
        ...(current[employeeId] || {}),
        [weekStartKey]: templateId,
      },
    }));
  }

  function saveAssignment(employee) {
    const employeePlan = draftWeeklyPlans[employee.id] || {};
    const weeklyPlan = weekOptions.map((week) => ({
      ...week,
      templateId: employeePlan[week.weekStartKey] || "",
    }));
    const missingWeeks = weeklyPlan.filter((week) => !week.templateId);

    if (missingWeeks.length) {
      showNotice("error", "Selecciona una plantilla para cada semana del empleado.");
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
            weeklyPlan,
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
        setDraftWeeklyPlans((current) => ({
          ...current,
          [employee.id]: buildDraftWeeklyPlan(payload.assignment, weekOptions),
        }));
        showNotice("success", payload.message);
      } catch (error) {
        showNotice("error", error.message);
      }
    });
  }

  function generateSchedules() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/planning/schedule-assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate",
            monthKey,
            branchCode,
            areaCode,
            roleCode,
          }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudieron generar los horarios.");
        }

        setAssignments(payload.assignments || []);
        setDraftWeeklyPlans(
          Object.fromEntries(
            (payload.assignments || []).map((assignment) => [
              assignment.employeeId,
              buildDraftWeeklyPlan(assignment, weekOptions),
            ]),
          ),
        );
        showNotice("success", payload.message);
      } catch (error) {
        showNotice("error", error.message);
      }
    });
  }

  function openEmployeeDetail(event, employeeId) {
    if (event.target.closest("select, button, a")) {
      return;
    }

    const params = new URLSearchParams({ month: monthKey });

    if (branchCode) {
      params.set("branchCode", branchCode);
    }

    if (areaCode) {
      params.set("areaCode", areaCode);
    }

    if (roleCode) {
      params.set("roleCode", roleCode);
    }

    router.push(`${planningModulePath(`/planning/monthly/${employeeId}`)}?${params.toString()}`);
  }

  if (isLoading) {
    return (
      <section className={styles.loadingScene} aria-live="polite">
        <div className={styles.loadingFilters}>
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} className={styles.skeletonField} />
          ))}
        </div>

        <div className={styles.loadingMetrics}>
          {Array.from({ length: 4 }, (_, index) => (
            <article key={index}>
              <span className={styles.skeletonTiny} />
              <strong className={styles.skeletonValue} />
            </article>
          ))}
        </div>

        <div className={styles.loadingTable}>
          <div className={styles.loadingTableHeader}>
            <span className={styles.skeletonTitle} />
            <span className={styles.skeletonAction} />
          </div>
          {Array.from({ length: 5 }, (_, rowIndex) => (
            <div key={rowIndex} className={styles.skeletonRow}>
              <span className={styles.skeletonPerson} />
              <span className={styles.skeletonCell} />
              <span className={styles.skeletonCell} />
              <span className={styles.skeletonCell} />
              <span className={styles.skeletonButton} />
            </div>
          ))}
        </div>
      </section>
    );
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
          <input
            type="month"
            value={monthKey}
            onChange={(event) => {
              setMonthKey(event.target.value);
              replaceFilters({ monthKey: event.target.value });
            }}
          />
        </label>
        <label>
          <span>Sucursal</span>
          <select
            value={branchCode}
            onChange={(event) => {
              setBranchCode(event.target.value);
              setAreaCode("");
              setRoleCode("");
              replaceFilters({ branchCode: event.target.value, areaCode: "", roleCode: "" });
            }}
          >
            <option value="">Todas</option>
            {branches.map((branch) => (
              <option key={branch.code} value={branch.code}>{branch.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Area</span>
          <select
            value={areaCode}
            onChange={(event) => {
              setAreaCode(event.target.value);
              setRoleCode("");
              replaceFilters({ areaCode: event.target.value, roleCode: "" });
            }}
          >
            <option value="">Todas</option>
            {areaOptions.map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Rol</span>
          <select
            value={roleCode}
            onChange={(event) => {
              setRoleCode(event.target.value);
              replaceFilters({ roleCode: event.target.value });
            }}
          >
            <option value="">Todos</option>
            {roleOptions.map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={styles.generateButton}
          onClick={generateSchedules}
          disabled={isPending || allFilteredEmployeesGenerated || !filteredEmployees.length}
        >
          {isPending ? <RefreshCw size={16} /> : <Wand2 size={16} />}
          {isPending ? "Generando..." : allFilteredEmployeesGenerated ? "Horarios generados" : "Generar horarios"}
        </button>
      </section>

      <section className={styles.summaryGrid}>
        <article>
          <span>Asignados</span>
          <strong>{summary.assignedEmployees}/{filteredEmployees.length}</strong>
        </article>
        <article>
          <span>Laborables</span>
          <strong>{summary.workdays}</strong>
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
          <span>{filteredEmployees.length} empleados para programar</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Rol base</th>
                {weekOptions.map((week) => (
                  <th key={week.weekStartKey} className={styles.weekColumn}>
                    <span>{week.label}</span>
                    <small>{week.rangeLabel}</small>
                  </th>
                ))}
                <th className={styles.summaryColumn}>Resumen mensual</th>
                <th className={styles.actionsColumn}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => {
                const assignment = assignmentsByEmployee.get(employee.id);
                const candidateTemplates = templatesByRole.get(`${employee.areaCode || ""}:${employee.roleCode || ""}`) || [];
                const employeePlan = draftWeeklyPlans[employee.id] || buildDraftWeeklyPlan(assignment || {}, weekOptions);
                const isComplete = weekOptions.every((week) => employeePlan[week.weekStartKey]);

                return (
                  <tr
                    key={employee.id}
                    className={styles.clickableRow}
                    onClick={(event) => openEmployeeDetail(event, employee.id)}
                  >
                    <td data-label="Empleado">
                      <strong>{employee.fullName}</strong>
                      <span>{employee.branchName || employee.branchCode || "Sin sucursal"}</span>
                    </td>
                    <td data-label="Rol base">
                      <strong>{employee.roleName || "Sin rol"}</strong>
                      <span>{employee.areaName || "Sin area"}</span>
                    </td>
                    {weekOptions.map((week) => (
                      <td key={week.weekStartKey} data-label={`${week.label} ${week.rangeLabel}`} className={styles.weekCell}>
                        <select
                          value={employeePlan[week.weekStartKey] || ""}
                          onChange={(event) => assignTemplate(employee.id, week.weekStartKey, event.target.value)}
                        >
                          <option value="">Seleccionar</option>
                          {candidateTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                    <td data-label="Resumen mensual" className={styles.summaryCell}>
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
                    <td data-label="Acciones" className={styles.actionsCell}>
                      <button type="button" onClick={() => saveAssignment(employee)} disabled={isPending || !isComplete}>
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
