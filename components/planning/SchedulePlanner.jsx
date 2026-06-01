"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, RefreshCw, Save, Wand2 } from "lucide-react";

import FloatingNotice from "@/components/ui/FloatingNotice";
import { formatEcuadorMonthKey } from "@/lib/datetime/ecuador";
import { planningModulePath } from "@/lib/modules/planning/routes";
import { getMonthWeekOptions } from "@/lib/planning/scheduleAssignments";
import styles from "./SchedulePlanner.module.scss";

const VARIABLE_SCHEDULE_AREA_CODES = new Set(["ALM", "BOD"]);

const SHIFT_OPTIONS = [
  {
    key: "off",
    label: "Descanso",
    shortLabel: "Desc.",
    dayType: "off_day",
    startTime: "",
    endTime: "",
    lunchDurationMinutes: 0,
    authorizedExtraMinutes: 0,
  },
  {
    key: "07-18",
    label: "07:00 - 18:00",
    shortLabel: "07-18",
    dayType: "workday",
    startTime: "07:00",
    endTime: "18:00",
    lunchDurationMinutes: 90,
    authorizedExtraMinutes: 60,
  },
  {
    key: "08-19",
    label: "08:00 - 19:00",
    shortLabel: "08-19",
    dayType: "workday",
    startTime: "08:00",
    endTime: "19:00",
    lunchDurationMinutes: 90,
    authorizedExtraMinutes: 60,
  },
  {
    key: "09-19",
    label: "09:00 - 19:00",
    shortLabel: "09-19",
    dayType: "workday",
    startTime: "09:00",
    endTime: "19:00",
    lunchDurationMinutes: 90,
    authorizedExtraMinutes: 60,
  },
  {
    key: "extra-08-14",
    label: "Extra 08:00 - 14:00",
    shortLabel: "Extra",
    dayType: "weekend_overtime",
    startTime: "08:00",
    endTime: "14:00",
    lunchDurationMinutes: 0,
    authorizedExtraMinutes: 360,
  },
];

const SHIFT_BY_KEY = new Map(SHIFT_OPTIONS.map((shift) => [shift.key, shift]));
const WORK_SHIFT_KEYS = ["07-18", "08-19", "09-19"];
const DAY_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

function currentMonthKey() {
  return formatEcuadorMonthKey();
}

function dateKeyFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthDateKeys(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(year, month - 1, 1, 12);
  const end = new Date(year, month, 1, 12);
  const dates = [];

  for (let date = start; date < end; date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 12)) {
    dates.push(dateKeyFromDate(date));
  }

  return dates;
}

function getDayOfWeek(dateKey) {
  return new Date(`${dateKey}T12:00:00`).getDay();
}

function getWeekStartKey(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff, 12);

  return dateKeyFromDate(monday);
}

function getWeekDateKeys(monthKey, weekStartKey) {
  return getMonthDateKeys(monthKey).filter((dateKey) => getWeekStartKey(dateKey) === weekStartKey);
}

function usesVariableSchedule(employee) {
  return VARIABLE_SCHEDULE_AREA_CODES.has(String(employee?.areaCode || "").trim().toUpperCase());
}

function dayToShiftKey(day) {
  if (!day || day.dayType === "off_day" || day.dayType === "holiday") {
    return "off";
  }

  if (day.dayType === "weekend_overtime") {
    return "extra-08-14";
  }

  const match = SHIFT_OPTIONS.find((shift) =>
    shift.dayType === "workday"
    && shift.startTime === day.startTime
    && shift.endTime === day.endTime,
  );

  return match?.key || "08-19";
}

function buildDraftDays(assignments) {
  return Object.fromEntries(
    assignments.map((assignment) => [
      assignment.employeeId,
      Object.fromEntries((assignment.generatedDays || []).map((day) => [day.dateKey, dayToShiftKey(day)])),
    ]),
  );
}

function buildPlannerUrl(filters) {
  const params = new URLSearchParams();

  if (filters.monthKey) params.set("month", filters.monthKey);
  if (filters.branchCode) params.set("branchCode", filters.branchCode);
  if (filters.areaCode) params.set("areaCode", filters.areaCode);
  if (filters.roleCode) params.set("roleCode", filters.roleCode);

  const query = params.toString();

  return `${planningModulePath("/planning/monthly")}${query ? `?${query}` : ""}`;
}

function buildOperationalDay(dateKey, shiftKey) {
  const shift = SHIFT_BY_KEY.get(shiftKey) || SHIFT_BY_KEY.get("off");
  const dayOfWeek = getDayOfWeek(dateKey);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const dayType = shift.dayType === "workday" && isWeekend ? "weekend_overtime" : shift.dayType;

  return {
    dateKey,
    dayType,
    startTime: shift.startTime,
    endTime: shift.endTime,
    lunchDurationMinutes: shift.lunchDurationMinutes,
    authorizedExtraMinutes: dayType === "weekend_overtime" ? Math.max(shift.authorizedExtraMinutes, 360) : shift.authorizedExtraMinutes,
  };
}

function isWorkShift(shiftKey) {
  return shiftKey && shiftKey !== "off";
}

export default function SchedulePlanner({ initialFilters = {} }) {
  const router = useRouter();
  const [monthKey, setMonthKey] = useState(initialFilters.month || currentMonthKey());
  const [branchCode, setBranchCode] = useState(initialFilters.branchCode || "");
  const [areaCode, setAreaCode] = useState(initialFilters.areaCode || "ALM");
  const [roleCode, setRoleCode] = useState(initialFilters.roleCode || "");
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [draftDays, setDraftDays] = useState({});
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [notice, setNotice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const noticeExitTimeoutRef = useRef(null);
  const noticeRemoveTimeoutRef = useRef(null);

  const weekOptions = useMemo(() => getMonthWeekOptions(monthKey), [monthKey]);
  const selectedWeek = weekOptions[selectedWeekIndex] || weekOptions[0];
  const weekDateKeys = useMemo(
    () => (selectedWeek ? getWeekDateKeys(monthKey, selectedWeek.weekStartKey) : []),
    [monthKey, selectedWeek],
  );

  const assignmentsByEmployee = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.employeeId, assignment])),
    [assignments],
  );

  const areaOptions = useMemo(() => {
    const options = new Map();

    employees.forEach((employee) => {
      if (employee.isActive === false || !usesVariableSchedule(employee)) return;
      if (branchCode && employee.branchCode !== branchCode) return;
      if (employee.areaCode) options.set(employee.areaCode, employee.areaName || employee.areaCode);
    });

    return [...options.entries()].sort((left, right) => left[1].localeCompare(right[1], "es"));
  }, [branchCode, employees]);

  const roleOptions = useMemo(() => {
    const options = new Map();

    employees.forEach((employee) => {
      if (employee.isActive === false || !usesVariableSchedule(employee)) return;
      if (branchCode && employee.branchCode !== branchCode) return;
      if (areaCode && employee.areaCode !== areaCode) return;
      if (employee.roleCode) options.set(employee.roleCode, employee.roleName || employee.roleCode);
    });

    return [...options.entries()].sort((left, right) => left[1].localeCompare(right[1], "es"));
  }, [areaCode, branchCode, employees]);

  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        if (employee.isActive === false || !usesVariableSchedule(employee)) return false;
        if (branchCode && employee.branchCode !== branchCode) return false;
        if (areaCode && employee.areaCode !== areaCode) return false;
        return !roleCode || employee.roleCode === roleCode;
      }),
    [areaCode, branchCode, employees, roleCode],
  );

  const coverageByDay = useMemo(() => {
    const result = new Map();

    weekDateKeys.forEach((dateKey) => {
      const roles = new Map();

      filteredEmployees.forEach((employee) => {
        const shiftKey = draftDays[employee.id]?.[dateKey] || "off";

        if (!isWorkShift(shiftKey)) return;

        const key = employee.roleCode || "SIN_ROL";
        const current = roles.get(key) || {
          roleName: employee.roleName || key,
          count: 0,
        };

        roles.set(key, { ...current, count: current.count + 1 });
      });

      result.set(dateKey, roles);
    });

    return result;
  }, [draftDays, filteredEmployees, weekDateKeys]);

  const summary = useMemo(() => {
    let programmedCells = 0;
    let restAlerts = 0;
    let coverageAlerts = 0;
    const roleKeys = new Set(filteredEmployees.map((employee) => employee.roleCode).filter(Boolean));

    filteredEmployees.forEach((employee) => {
      const restDays = weekDateKeys.filter((dateKey) => !isWorkShift(draftDays[employee.id]?.[dateKey] || "off")).length;
      programmedCells += weekDateKeys.filter((dateKey) => draftDays[employee.id]?.[dateKey]).length;

      if (weekDateKeys.length >= 7 && restDays < 2) {
        restAlerts += 1;
      }
    });

    weekDateKeys.forEach((dateKey) => {
      const roles = coverageByDay.get(dateKey) || new Map();

      roleKeys.forEach((roleKey) => {
        if (!roles.get(roleKey)?.count) {
          coverageAlerts += 1;
        }
      });
    });

    return {
      employees: filteredEmployees.length,
      programmedCells,
      totalCells: filteredEmployees.length * weekDateKeys.length,
      restAlerts,
      coverageAlerts,
    };
  }, [coverageByDay, draftDays, filteredEmployees, weekDateKeys]);

  const clearNoticeTimers = useCallback(() => {
    if (noticeExitTimeoutRef.current) window.clearTimeout(noticeExitTimeoutRef.current);
    if (noticeRemoveTimeoutRef.current) window.clearTimeout(noticeRemoveTimeoutRef.current);
    noticeExitTimeoutRef.current = null;
    noticeRemoveTimeoutRef.current = null;
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

  const replaceFilters = useCallback((nextFilters) => {
    router.replace(buildPlannerUrl({
      monthKey,
      branchCode,
      areaCode,
      roleCode,
      ...nextFilters,
    }), { scroll: false });
  }, [areaCode, branchCode, monthKey, roleCode, router]);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      try {
        const [employeesResponse, branchesResponse] = await Promise.all([
          fetch("/api/employees"),
          fetch("/api/branches"),
        ]);
        const [employeesPayload, branchesPayload] = await Promise.all([
          employeesResponse.json(),
          branchesResponse.json(),
        ]);

        if (!employeesResponse.ok) throw new Error(employeesPayload.error || "No se pudieron cargar los empleados.");
        if (!branchesResponse.ok) throw new Error(branchesPayload.error || "No se pudieron cargar las sucursales.");

        if (!isCancelled) {
          setEmployees(employeesPayload.employees || []);
          setBranches(branchesPayload.branches || []);
        }
      } catch (error) {
        if (!isCancelled) showNotice("error", error.message);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isCancelled = true;
      clearNoticeTimers();
    };
  }, [clearNoticeTimers, showNotice]);

  useEffect(() => {
    if (isLoading) return;

    let isCancelled = false;

    async function loadAssignments() {
      try {
        const params = new URLSearchParams({ month: monthKey });

        if (branchCode) params.set("branchCode", branchCode);

        const response = await fetch(`/api/planning/schedule-assignments?${params.toString()}`);
        const payload = await response.json();

        if (!response.ok) throw new Error(payload.error || "No se pudieron cargar las asignaciones.");

        if (!isCancelled) {
          const nextAssignments = payload.assignments || [];

          setAssignments(nextAssignments);
          setDraftDays(buildDraftDays(nextAssignments));
        }
      } catch (error) {
        if (!isCancelled) showNotice("error", error.message);
      }
    }

    loadAssignments();

    return () => {
      isCancelled = true;
    };
  }, [branchCode, isLoading, monthKey, showNotice]);

  function setCell(employeeId, dateKey, shiftKey) {
    setDraftDays((current) => ({
      ...current,
      [employeeId]: {
        ...(current[employeeId] || {}),
        [dateKey]: shiftKey,
      },
    }));
  }

  function generateWeek() {
    setDraftDays((current) => {
      const next = { ...current };
      const employeesByRole = filteredEmployees.reduce((map, employee) => {
        const key = employee.roleCode || "SIN_ROL";

        if (!map.has(key)) map.set(key, []);
        map.get(key).push(employee);
        return map;
      }, new Map());

      for (const [, roleEmployees] of employeesByRole.entries()) {
        roleEmployees.forEach((employee, employeeIndex) => {
          const employeeDays = { ...(next[employee.id] || {}) };
          const firstRestIndex = roleEmployees.length > 1 ? (employeeIndex * 2) % Math.max(weekDateKeys.length, 1) : 5;
          const restIndexes = new Set([
            firstRestIndex,
            (firstRestIndex + 1) % Math.max(weekDateKeys.length, 1),
          ]);

          weekDateKeys.forEach((dateKey, dayIndex) => {
            if (restIndexes.has(dayIndex)) {
              employeeDays[dateKey] = "off";
              return;
            }

            employeeDays[dateKey] = WORK_SHIFT_KEYS[(employeeIndex + dayIndex) % WORK_SHIFT_KEYS.length];
          });

          next[employee.id] = employeeDays;
        });
      }

      return next;
    });
    showNotice("success", "Semana generada. Revisa cobertura y descansos antes de guardar.");
  }

  function saveWeek() {
    startTransition(async () => {
      try {
        const employeeDays = filteredEmployees.map((employee) => ({
          employeeId: employee.id,
          days: weekDateKeys.map((dateKey) =>
            buildOperationalDay(dateKey, draftDays[employee.id]?.[dateKey] || "off"),
          ),
        }));
        const response = await fetch("/api/planning/schedule-assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "operational-save",
            monthKey,
            employeeDays,
          }),
        });
        const payload = await response.json();

        if (!response.ok) throw new Error(payload.error || "No se pudo guardar la programacion.");

        const nextAssignments = payload.assignments || [];

        setAssignments(nextAssignments);
        setDraftDays(buildDraftDays(nextAssignments));
        showNotice("success", payload.message);
      } catch (error) {
        showNotice("error", error.message);
      }
    });
  }

  function openEmployeeDetail(event, employeeId) {
    if (event.target.closest("select, button, a")) return;

    const params = new URLSearchParams({ month: monthKey });

    if (branchCode) params.set("branchCode", branchCode);
    if (areaCode) params.set("areaCode", areaCode);
    if (roleCode) params.set("roleCode", roleCode);

    router.push(`${planningModulePath(`/planning/monthly/${employeeId}`)}?${params.toString()}`);
  }

  if (isLoading) {
    return (
      <section className={styles.loadingScene} aria-live="polite">
        <div className={styles.loadingFilters}>
          {Array.from({ length: 5 }, (_, index) => <span key={index} className={styles.skeletonField} />)}
        </div>
        <div className={styles.loadingMetrics}>
          {Array.from({ length: 4 }, (_, index) => (
            <article key={index}>
              <span className={styles.skeletonTiny} />
              <strong className={styles.skeletonValue} />
            </article>
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
          <p className={styles.eyebrow}>Programacion operativa</p>
          <h2>Horario semanal sin plantillas</h2>
          <p className={styles.toolbarHint}>
            Arma turnos reales por dia. Las preferencias especiales se resuelven moviendo descansos antes de guardar.
          </p>
        </div>
        <label>
          <span>Mes</span>
          <input
            type="month"
            value={monthKey}
            onChange={(event) => {
              setMonthKey(event.target.value);
              setSelectedWeekIndex(0);
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
              setRoleCode("");
              replaceFilters({ branchCode: event.target.value, roleCode: "" });
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
      </section>

      <section className={styles.weekToolbar}>
        <div className={styles.weekTabs}>
          {weekOptions.map((week, index) => (
            <button
              key={week.weekStartKey}
              type="button"
              className={index === selectedWeekIndex ? styles.activeWeek : ""}
              onClick={() => setSelectedWeekIndex(index)}
            >
              <strong>{week.label}</strong>
              <span>{week.rangeLabel}</span>
            </button>
          ))}
        </div>
        <div className={styles.weekActions}>
          <button type="button" onClick={generateWeek} disabled={isPending || !filteredEmployees.length}>
            <Wand2 size={16} />
            Generar semana
          </button>
          <button type="button" onClick={saveWeek} disabled={isPending || !filteredEmployees.length}>
            {isPending ? <RefreshCw size={16} /> : <Save size={16} />}
            {isPending ? "Guardando..." : "Guardar semana"}
          </button>
        </div>
      </section>

      <section className={styles.summaryGrid}>
        <article>
          <span>Empleados</span>
          <strong>{summary.employees}</strong>
        </article>
        <article>
          <span>Programado</span>
          <strong>{summary.programmedCells}/{summary.totalCells}</strong>
        </article>
        <article>
          <span>Alertas cobertura</span>
          <strong>{summary.coverageAlerts}</strong>
        </article>
        <article>
          <span>Alertas descanso</span>
          <strong>{summary.restAlerts}</strong>
        </article>
      </section>

      <section className={styles.coveragePanel}>
        <div className={styles.tableHeader}>
          <CalendarDays size={18} />
          <span>Cobertura por rol base</span>
        </div>
        <div className={styles.coverageGrid}>
          {weekDateKeys.map((dateKey) => {
            const roles = [...(coverageByDay.get(dateKey) || new Map()).values()];

            return (
              <article key={dateKey}>
                <strong>{DAY_LABELS[getDayOfWeek(dateKey)]} {dateKey.slice(8)}</strong>
                {roles.length ? (
                  roles.map((role) => (
                    <span key={role.roleName}>{role.roleName}: {role.count}</span>
                  ))
                ) : (
                  <span>Sin cobertura</span>
                )}
              </article>
            );
          })}
        </div>
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
                {weekDateKeys.map((dateKey) => (
                  <th key={dateKey} className={styles.dayColumn}>
                    <span>{DAY_LABELS[getDayOfWeek(dateKey)]}</span>
                    <small>{dateKey.slice(8)}</small>
                  </th>
                ))}
                <th>Descansos</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => {
                const restCount = weekDateKeys.filter((dateKey) =>
                  !isWorkShift(draftDays[employee.id]?.[dateKey] || "off"),
                ).length;
                const assignment = assignmentsByEmployee.get(employee.id);

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
                      <span>{assignment?.templateName || "Operativo"}</span>
                    </td>
                    {weekDateKeys.map((dateKey) => (
                      <td key={dateKey} data-label={`${DAY_LABELS[getDayOfWeek(dateKey)]} ${dateKey.slice(8)}`}>
                        <select
                          value={draftDays[employee.id]?.[dateKey] || "off"}
                          onChange={(event) => setCell(employee.id, dateKey, event.target.value)}
                        >
                          {SHIFT_OPTIONS.map((shift) => (
                            <option key={shift.key} value={shift.key}>{shift.label}</option>
                          ))}
                        </select>
                      </td>
                    ))}
                    <td data-label="Descansos">
                      <span className={restCount >= 2 ? styles.okPill : styles.warnPill}>
                        {restCount} dias
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
